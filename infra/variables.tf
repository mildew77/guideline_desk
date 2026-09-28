variable "aws_region" {
  description = "AWS region for Amplify, Lambda, and EventBridge."
  type        = string
  default     = "us-east-1"
}

variable "app_name" {
  description = "Name used for AWS resources."
  type        = string
  default     = "guideline-desk"
}

variable "production_branch" {
  description = "Git branch deployed to production."
  type        = string
  default     = "main"
}

variable "repository_url" {
  description = "HTTPS URL of the GitHub, GitLab, Bitbucket, or CodeCommit repository. Leave null until a repository is connected."
  type        = string
  default     = null
  nullable    = true
}

variable "repository_oauth_token" {
  description = "Repository provider token used only by Amplify. Set through TF_VAR_repository_oauth_token; never commit it."
  type        = string
  default     = null
  nullable    = true
  sensitive   = true
}

variable "root_domain_name" {
  description = "The Route 53 hosted-zone domain."
  type        = string
  default     = "marshall.mortgage"
}

variable "subdomain" {
  description = "Valid DNS label for the production site. Underscores are not permitted in browser hostnames."
  type        = string
  default     = "guideline-desk"

  validation {
    condition     = can(regex("^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$", var.subdomain))
    error_message = "subdomain must be a valid lowercase DNS label: letters, numbers, and hyphens only."
  }
}

variable "route53_hosted_zone_id" {
  description = "Route 53 hosted zone ID for root_domain_name. Leave null when DNS is managed outside Route 53."
  type        = string
  default     = null
  nullable    = true
}

variable "supabase_url" {
  description = "Supabase project URL. This is public configuration and is used only by the scheduled health query."
  type        = string
}

variable "supabase_publishable_key" {
  description = "Supabase publishable/anon key used by the scheduled health query. It is designed to be public; do not use a secret/service-role key."
  type        = string
  sensitive   = true
}
