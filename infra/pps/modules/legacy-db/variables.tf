variable "name" {
  description = "서버 · DNS zone 이름의 가운데 부분(pg-<name>-xxxxx)"
  type        = string
}
variable "resource_group_name" { type = string }
variable "location" { type = string }
variable "tags" {
  type    = map(string)
  default = {}
}
variable "vnet_id" { type = string }
variable "subnet_id" {
  description = "PostgreSQL Flexible 위임 서브넷"
  type        = string
}
variable "databases" {
  type    = list(string)
  default = ["pps_legacy"]
}
variable "pg_version" {
  type    = string
  default = "16"
}
variable "sku" {
  type    = string
  default = "B_Standard_B1ms"
}
variable "storage_mb" {
  type    = number
  default = 32768
}
variable "admin_login" {
  type    = string
  default = "ppsadmin"
}
