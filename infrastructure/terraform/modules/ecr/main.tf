# Amazon ECR: satu repository per image (backend API, worker Celery, frontend Next.js).

variable "project" { type = string }
variable "repositories" { type = list(string) }

variable "keep_last_images" {
  type    = number
  default = 15
}

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

resource "aws_ecr_repository" "this" {
  for_each             = toset(var.repositories)
  name                 = "${var.project}-${each.value}"
  image_tag_mutability = "MUTABLE" # tag "latest" ditimpa; tag commit SHA tetap unik

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "AES256"
  }
}

resource "aws_ecr_lifecycle_policy" "this" {
  for_each   = aws_ecr_repository.this
  repository = each.value.name
  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Hapus image tanpa tag setelah 7 hari"
        selection    = { tagStatus = "untagged", countType = "sinceImagePushed", countUnit = "days", countNumber = 7 }
        action       = { type = "expire" }
      },
      {
        rulePriority = 2
        description  = "Simpan ${var.keep_last_images} image terakhir"
        selection    = { tagStatus = "any", countType = "imageCountMoreThan", countNumber = var.keep_last_images }
        action       = { type = "expire" }
      },
    ]
  })
}

output "registry" {
  value = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${data.aws_region.current.name}.amazonaws.com"
}

output "repository_urls" {
  value = { for k, r in aws_ecr_repository.this : k => r.repository_url }
}

output "repository_arns" {
  value = { for k, r in aws_ecr_repository.this : k => r.arn }
}
