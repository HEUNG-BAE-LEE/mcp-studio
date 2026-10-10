variable "name" {
  description = "VM · NIC 이름의 뒷부분(vm-<name>, nic-<name>)"
  type        = string
}
variable "resource_group_name" { type = string }
variable "location" { type = string }
variable "tags" {
  type    = map(string)
  default = {}
}
variable "subnet_id" { type = string }
variable "private_ip" {
  description = "고정 사설 IP. 앱의 시연 값 · 명세의 서버 주소가 이 값을 가리킨다"
  type        = string
}
variable "size" {
  type    = string
  default = "Standard_B2s"
}
variable "admin_username" {
  type    = string
  default = "ppsadm"
}
variable "admin_ssh_public_key" {
  description = "관리자 공개키. 공인 IP 가 없어 접속 경로는 없다 — 형식상 필요"
  type        = string
}
variable "packages" {
  description = "cloud-init 으로 설치할 배포판 패키지"
  type        = list(string)
  default     = ["python3-venv", "python3-pip", "postgresql-client"]
}
variable "service_user" {
  description = "레거시 서비스를 돌릴 로그인 불가 계정"
  type        = string
  default     = "legacy"
}
variable "install_dir" {
  type    = string
  default = "/opt/legacy-pps"
}
variable "auto_shutdown_time" {
  description = "매일 끄는 시각(HHMM, 한국 시간). null 이면 끄지 않는다"
  type        = string
  default     = "2200"
}
