variable "prefix" { type = string }
variable "app_name" {
  type    = string
  default = "ieum"
}
variable "resource_group_name" { type = string }
variable "location" { type = string }
variable "tags" {
  type    = map(string)
  default = {}
}
variable "subnet_id" {
  description = "Container Apps 위임 서브넷(/23 이상)"
  type        = string
}
variable "acr_name" {
  description = "이미 있는 ACR. 참조만 한다 — 만들거나 지우지 않는다"
  type        = string
}
variable "acr_resource_group_name" { type = string }
variable "image" {
  description = "첫 apply 는 자리표시자로 둔다. 실제 이미지는 배포 스크립트가 바꾼다"
  type        = string
  default     = "mcr.microsoft.com/k8se/quickstart:latest"
}
variable "target_port" {
  type    = number
  default = 8000
}
variable "cpu" {
  type    = number
  default = 1.0
}
variable "memory" {
  type    = string
  default = "2Gi"
}
variable "env" {
  description = "평문 환경변수"
  type        = map(string)
  default     = {}
}
variable "secret_env" {
  description = "비밀 환경변수(Container Apps secret 으로 넣는다)"
  type        = map(string)
  sensitive   = true
  default     = {}
}
variable "allowed_cidrs" {
  description = "들어올 수 있는 대역. 비우면 아무도 못 들어온다"
  type        = list(string)
  validation {
    condition     = length(var.allowed_cidrs) > 0 && !contains(var.allowed_cidrs, "0.0.0.0/0")
    error_message = "허용 대역을 하나 이상, 0.0.0.0/0 이 아닌 값으로 지정할 것 — 콘솔은 인증 없이 열려 있다."
  }
}
