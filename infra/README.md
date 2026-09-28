# Guideline Desk production infrastructure

This Terraform configuration creates:

- an AWS Amplify Hosting Compute app for the existing Next.js 15 application;
- a production branch and custom hostname;
- a least-privilege Lambda that calls a narrow Supabase RPC every five days;
- an EventBridge rule and 30-day CloudWatch log retention.

## Important hostname correction

`guideline_desk.marshall.mortgage` cannot be used as a website hostname. DNS host labels and TLS certificates cannot contain an underscore. This configuration uses `guideline-desk.marshall.mortgage` instead.

## Before the first apply

1. Run the SQL in `../supabase/migrations/002_guideline_desk_keepalive.sql` in the Supabase SQL Editor.
2. Ensure the app is in a Git repository supported by Amplify. This workspace currently has no GitHub, GitLab, Bitbucket, or CodeCommit remote, so a repository URL must be supplied before automatic deployment can work.
3. If `marshall.mortgage` is in Route 53, obtain its hosted-zone ID. If DNS is elsewhere, leave `route53_hosted_zone_id` null and Terraform will output the two CNAME records to add there.
4. Copy the example variables file:

   ```sh
   cd infra
   cp terraform.tfvars.example terraform.tfvars
   ```

5. Add a repository OAuth token only through your shell, never the variables file:

   ```sh
   export TF_VAR_repository_oauth_token='your-provider-token'
   ```

## Apply

```sh
cd infra
terraform init
terraform plan
terraform apply
```

## Add production secrets after Terraform creates the Amplify app

Terraform intentionally does not receive or store the OpenAI key or Supabase secret key. After the apply, use the `amplify_environment_secret_paths` output to create two SecureString Parameter Store values:

```sh
aws ssm put-parameter --name '/amplify/APP_ID/main/OPENAI_API_KEY' --type SecureString --value '...' --overwrite
aws ssm put-parameter --name '/amplify/APP_ID/main/SUPABASE_SECRET_KEY' --type SecureString --value '...' --overwrite
```

Then redeploy the Amplify production branch. The app supports Amplify's `process.env.secrets` format while retaining the existing `.env.local` development workflow.

The Lambda receives only the Supabase URL and publishable key; it does not use the Supabase secret/service-role key. It calls `guideline_desk_keepalive`, which runs a database count but returns no guideline data.

## IAM policy

Attach `iam/terraform-deployer-policy.json` to the IAM identity running Terraform. Replace `REGION`, `ACCOUNT_ID`, and `HOSTED_ZONE_ID` before attaching it. If your CodeCommit repository has a different name, replace `guideline-desk` in its CodeCommit ARN. The policy grants deployment permissions only; it cannot and should not grant access to OpenAI or Supabase credentials.
