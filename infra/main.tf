locals {
  site_hostname = "${var.subdomain}.${var.root_domain_name}"
  tags = {
    Application = var.app_name
    ManagedBy   = "Terraform"
  }
}

resource "aws_amplify_app" "guideline_desk" {
  name                        = var.app_name
  platform                    = "WEB_COMPUTE"
  repository                  = var.repository_url
  oauth_token                 = var.repository_oauth_token
  iam_service_role_arn        = aws_iam_role.amplify_build.arn
  build_spec                  = file("${path.module}/../amplify.yml")
  enable_auto_branch_creation = false

  # The project URL is public configuration. Secret keys are added separately
  # as Amplify Parameter Store environment secrets after the app exists.
  environment_variables = {
    NEXT_PUBLIC_SUPABASE_URL           = var.supabase_url
    OPENAI_API_KEY_PARAMETER_NAME      = "/amplify/${var.amplify_app_id}/${var.production_branch}/OPENAI_API_KEY"
    SUPABASE_SECRET_KEY_PARAMETER_NAME = "/amplify/${var.amplify_app_id}/${var.production_branch}/SUPABASE_SECRET_KEY"
  }

  tags = local.tags
}

# Amplify assumes this role when it clones the private CodeCommit repository.
resource "aws_iam_role" "amplify_build" {
  name = "${var.app_name}-amplify-build"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "amplify.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = local.tags
}

resource "aws_iam_role_policy" "amplify_codecommit_read" {
  name = "${var.app_name}-amplify-codecommit-read"
  role = aws_iam_role.amplify_build.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "codecommit:GetRepository",
        "codecommit:GetBranch",
        "codecommit:GetCommit",
        "codecommit:GetRepositoryTriggers",
        "codecommit:GitPull"
      ]
      Resource = "arn:aws:codecommit:${var.aws_region}:${var.aws_account_id}:guideline_desk"
    }]
  })
}

# Required for Amplify Hosting to resolve this app's SecureString environment
# secrets from Parameter Store during deployment and SSR initialization.
resource "aws_iam_role_policy" "amplify_environment_secrets" {
  name = "${var.app_name}-amplify-environment-secrets"
  role = aws_iam_role.amplify_build.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "ssm:GetParameter",
        "ssm:GetParameters"
      ]
      Resource = "arn:aws:ssm:${var.aws_region}:${var.aws_account_id}:parameter/amplify/${aws_amplify_app.guideline_desk.id}/${var.production_branch}/*"
    }]
  })
}

# Required when a customer-managed role is used with Amplify Hosting Compute.
resource "aws_iam_role_policy" "amplify_compute_logs" {
  name = "${var.app_name}-amplify-compute-logs"
  role = aws_iam_role.amplify_build.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:DescribeLogGroups",
        "logs:PutLogEvents"
      ]
      Resource = "*"
    }]
  })
}

resource "aws_amplify_branch" "production" {
  app_id            = aws_amplify_app.guideline_desk.id
  branch_name       = var.production_branch
  stage             = "PRODUCTION"
  enable_auto_build = var.repository_url != null
  framework         = "Next.js - SSR"
}

# Amplify provisions the certificate and serves this branch at the custom hostname.
resource "aws_amplify_domain_association" "production" {
  app_id      = aws_amplify_app.guideline_desk.id
  domain_name = var.root_domain_name

  sub_domain {
    branch_name = aws_amplify_branch.production.branch_name
    prefix      = var.subdomain
  }
}

locals {
  certificate_record_parts = split(" ", aws_amplify_domain_association.production.certificate_verification_dns_record)
  subdomain_record_parts   = split(" ", one(aws_amplify_domain_association.production.sub_domain).dns_record)
}

# These records are created only when marshall.mortgage is hosted in Route 53.
resource "aws_route53_record" "certificate_validation" {
  count           = var.route53_hosted_zone_id == null ? 0 : 1
  allow_overwrite = true
  zone_id         = var.route53_hosted_zone_id
  name            = local.certificate_record_parts[0]
  type            = local.certificate_record_parts[1]
  ttl             = 300
  records         = [local.certificate_record_parts[2]]
}

resource "aws_route53_record" "site" {
  count           = var.route53_hosted_zone_id == null ? 0 : 1
  allow_overwrite = true
  zone_id         = var.route53_hosted_zone_id
  name            = local.subdomain_record_parts[0]
  type            = local.subdomain_record_parts[1]
  ttl             = 300
  records         = [local.subdomain_record_parts[2]]
}

resource "aws_iam_role" "supabase_keepalive" {
  name = "${var.app_name}-supabase-keepalive"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = local.tags
}

resource "aws_iam_role_policy" "supabase_keepalive_logs" {
  name = "${var.app_name}-supabase-keepalive-logs"
  role = aws_iam_role.supabase_keepalive.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["logs:CreateLogStream", "logs:PutLogEvents"]
      Resource = "${aws_cloudwatch_log_group.supabase_keepalive.arn}:*"
    }]
  })
}

resource "aws_cloudwatch_log_group" "supabase_keepalive" {
  name              = "/aws/lambda/${var.app_name}-supabase-keepalive"
  retention_in_days = 30
  tags              = local.tags
}

data "archive_file" "supabase_keepalive" {
  type        = "zip"
  source_file = "${path.module}/lambda/supabase-keepalive.js"
  output_path = "${path.module}/.build/supabase-keepalive.zip"
}

resource "aws_lambda_function" "supabase_keepalive" {
  function_name    = "${var.app_name}-supabase-keepalive"
  description      = "Executes a small Supabase RPC query to keep the project active."
  role             = aws_iam_role.supabase_keepalive.arn
  handler          = "supabase-keepalive.handler"
  runtime          = "nodejs22.x"
  filename         = data.archive_file.supabase_keepalive.output_path
  source_code_hash = data.archive_file.supabase_keepalive.output_base64sha256
  timeout          = 15
  memory_size      = 128

  environment {
    variables = {
      SUPABASE_URL             = var.supabase_url
      SUPABASE_PUBLISHABLE_KEY = var.supabase_publishable_key
    }
  }

  depends_on = [aws_cloudwatch_log_group.supabase_keepalive]
  tags       = local.tags
}

resource "aws_cloudwatch_event_rule" "supabase_keepalive" {
  name                = "${var.app_name}-supabase-keepalive-every-five-days"
  description         = "Keeps the Supabase project active every five days."
  schedule_expression = "rate(5 days)"
  tags                = local.tags
}

resource "aws_cloudwatch_event_target" "supabase_keepalive" {
  rule = aws_cloudwatch_event_rule.supabase_keepalive.name
  arn  = aws_lambda_function.supabase_keepalive.arn
}

resource "aws_lambda_permission" "allow_eventbridge_keepalive" {
  statement_id  = "AllowEventBridgeKeepalive"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.supabase_keepalive.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.supabase_keepalive.arn
}
