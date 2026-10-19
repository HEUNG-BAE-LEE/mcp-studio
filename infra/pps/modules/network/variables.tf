variable "prefix" {
  description = "리소스 이름 접두사. 같은 RG 의 다른 스택과 겹치지 않게 한다"
  type        = string
}
variable "resource_group_name" { type = string }
variable "location" { type = string }
variable "tags" {
  type    = map(string)
  default = {}
}
variable "address_space" {
  description = "VNet 대역. 같은 구독 · 연결할 hub 의 다른 VNet 과 겹치지 않아야 한다"
  type        = string
}
variable "subnets" {
  description = "app(위임: Container Apps, /23 이상) · legacy · db(위임: PostgreSQL Flexible) · pe(사설 엔드포인트)"
  type = object({
    app    = string
    legacy = string
    db     = string
    pe     = string
  })
}
variable "legacy_ports" {
  description = "앱 서브넷이 레거시에 열 수 있는 포트(외부연동 F/W 허용 목록)"
  type        = list(string)
}
variable "internet_lockdown" {
  description = "true 면 레거시 서브넷의 인터넷 아웃바운드를 막는다(반입 후 밀봉)"
  type        = bool
  default     = false
}
