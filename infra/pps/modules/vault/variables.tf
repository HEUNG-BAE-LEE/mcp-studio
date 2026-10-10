variable "prefix" { type = string }
variable "resource_group_name" { type = string }
variable "location" { type = string }
variable "tags" {
  type    = map(string)
  default = {}
}
variable "vnet_id" { type = string }
variable "pe_subnet_id" { type = string }
variable "public_during_apply" {
  description = "apply 하는 PC 에서 비밀값을 넣을 때만 true. 공개 접근 금지 정책이 있는 구독은 false(그때 secrets 는 건너뛴다)"
  type        = bool
  default     = false
}
variable "secrets" {
  description = "이름 → 값. 이름은 Key Vault 규칙(영문 · 숫자 · 하이픈)"
  type        = map(string)
  sensitive   = true
  default     = {}
}
