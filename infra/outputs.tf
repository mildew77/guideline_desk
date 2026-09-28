output "amplify_app_id" {
  value = aws_amplify_app.guideline_desk.id
}

output "amplify_default_url" {
  value = "https://${aws_amplify_branch.production.branch_name}.${aws_amplify_app.guideline_desk.default_domain}"
}

output "production_url" {
  value = "https://${local.site_hostname}"
}

output "dns_records_if_not_using_route53" {
  description = "Create these CNAME records at your DNS provider if route53_hosted_zone_id is null."
  value = {
    certificate_validation = aws_amplify_domain_association.production.certificate_verification_dns_record
    site                   = one(aws_amplify_domain_association.production.sub_domain).dns_record
  }
}

output "amplify_environment_secret_paths" {
  description = "Create these as SecureString parameters after Terraform applies. Amplify supplies their values in process.env.secrets."
  value = {
    openai_api_key      = "/amplify/${aws_amplify_app.guideline_desk.id}/${var.production_branch}/OPENAI_API_KEY"
    supabase_secret_key = "/amplify/${aws_amplify_app.guideline_desk.id}/${var.production_branch}/SUPABASE_SECRET_KEY"
  }
}
