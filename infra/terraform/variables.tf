variable "subscription_id" {
  description = "배포 대상 구독. 개인(personal) 구독만 허용한다."
  type        = string
  default     = "3c7b1819-c657-41ca-a22e-b6dc6d34fd98" # sub-open-axd-personal-01

  # 회사 프로젝트 구독(sub-open-axd-project-01)에 이 스택이 올라가면 안 된다.
  # 실수로 -var 나 ARM_SUBSCRIPTION_ID 가 섞여 들어오는 경우를 여기서 끊는다.
  validation {
    condition     = var.subscription_id != "d69e62aa-ef39-4bc0-b745-57ebc2bddcc8"
    error_message = "회사 프로젝트 구독(sub-open-axd-project-01)에는 배포할 수 없다. 개인 구독을 쓸 것."
  }
}

variable "resource_group_name" {
  description = "이미 존재하는 개인 리소스 그룹. 이 스택은 리소스 그룹을 만들지 않는다."
  type        = string
  default     = "azure_test-a89a8649-741-rg001"
}

variable "container_registry_name" {
  description = "이미 존재하는 ACR. 이미지는 여기에 올라간다."
  type        = string
  default     = "wtembed10835"
}

variable "name_prefix" {
  description = "만들어지는 리소스 이름의 앞자리"
  type        = string
  default     = "mcp-studio"
}

variable "container_image" {
  description = <<-EOT
    첫 apply 시점에는 ACR 에 이미지가 없으므로 공개 자리표시자 이미지로 시작한다.
    실제 이미지는 GitHub Actions 가 `az containerapp update --image` 로 바꾸며,
    Terraform 은 그 변경을 무시한다(main.tf 의 ignore_changes).
  EOT
  type        = string
  default     = "mcr.microsoft.com/k8se/quickstart:latest"
}

variable "min_replicas" {
  description = "0 이면 요청이 없을 때 0 으로 줄어든다(비용 0, 첫 요청 지연 수초)."
  type        = number
  default     = 0
}

variable "max_replicas" {
  description = <<-EOT
    SQLite 파일 하나를 컨테이너 안에서 쓰므로 1 을 넘기면 복제본마다 DB 가 갈린다.
    늘리기 전에 DB 를 외부(PostgreSQL 등)로 옮길 것.
  EOT
  type        = number
  default     = 1
}

variable "github_repository" {
  description = "OIDC 로 배포를 허용할 GitHub 저장소 (owner/repo)"
  type        = string
  default     = "HEUNG-BAE-LEE/mcp-studio"
}

# 이름이 아니라 숫자 ID 다. `gh api repos/<owner>/<repo> --jq '.owner.id, .id'`
variable "github_owner_id" {
  description = "GitHub 소유자의 불변 숫자 ID (OIDC subject 에 들어간다)"
  type        = string
  default     = "23379622"
}

variable "github_repository_id" {
  description = "GitHub 저장소의 불변 숫자 ID (OIDC subject 에 들어간다)"
  type        = string
  default     = "1312471061"
}

variable "github_deploy_branch" {
  description = "이 브랜치의 워크플로만 Azure 에 로그인할 수 있다."
  type        = string
  default     = "master"
}

# --- LLM 콘솔용 Azure OpenAI ----------------------------------------------------
# 개인 리소스 그룹의 az-openai-wt-test 는 공용 네트워크 접근이 꺼져 있어(private
# endpoint 전용) Container Apps 에서 닿지 않는다. 그래서 자동 연결하지 않고 값을
# 비워 둔다. 비어 있으면 환경변수를 아예 넣지 않으므로 LLM 콘솔만 동작하지 않고
# 수집·액션 화면은 그대로 돈다.
variable "azure_openai_endpoint" {
  description = "예: https://<리소스>.openai.azure.com/ (공용 접근이 가능한 것)"
  type        = string
  default     = ""
}

variable "azure_openai_api_key" {
  description = "Container Apps 시크릿으로 저장된다. tfvars 파일은 커밋하지 않는다."
  type        = string
  default     = ""
  sensitive   = true
}

variable "azure_openai_api_version" {
  type    = string
  default = "2025-04-01-preview"
}

variable "azure_openai_deployment" {
  type    = string
  default = ""
}

variable "tags" {
  description = "리소스 태그"
  type        = map(string)
  default = {
    project = "mcp-studio"
    owner   = "personal"
    purpose = "ai-competition-demo"
  }
}
