variable "subscription_id" {
  description = "배포 대상 구독"
  type        = string
}

variable "resource_group_name" {
  description = "이미 존재하는 리소스 그룹. 기본값을 두지 않는다 — 다른 서비스의 리소스 그룹으로 잘못 들어가는 사고를 막는다."
  type        = string
}

variable "container_registry_name" {
  description = "이미 존재하는 공유 ACR. 참조만 한다 — 레지스트리를 만들거나 지우지 않는다."
  type        = string
}

variable "name_prefix" {
  type    = string
  default = "pps"
}

variable "location" {
  type    = string
  default = "koreacentral"
}

variable "address_space" {
  description = "다른 서비스 VNet(10.60/16 등)과 겹치지 않는 대역"
  type        = string
  default     = "10.70.0.0/16"
}
variable "subnets" {
  description = "address_space 안의 서브넷. app 은 Container Apps 위임이라 /23 이상"
  type = object({
    app    = string
    legacy = string
    db     = string
    pe     = string
  })
  default = {
    app    = "10.70.2.0/23"
    legacy = "10.70.1.0/24"
    db     = "10.70.4.0/24"
    pe     = "10.70.5.0/26"
  }
}

variable "legacy_ports" {
  description = "이음이 레거시에 열 수 있는 포트(외부연동 F/W 허용 목록)"
  type        = list(string)
  default     = ["18001-18004"]
}

variable "vm_auto_shutdown_time" {
  description = "레거시 VM 을 매일 끄는 시각(HHMM, 한국 시간). null 이면 끄지 않는다"
  type        = string
  default     = "2200"
}

variable "environment" {
  description = "환경 이름. 태그 · CI/CD 앱 이름에 쓴다. 같은 모듈로 prod 를 올릴 때는 name_prefix · 상태 키와 함께 바꾼다"
  type        = string
  default     = "staging"
}

variable "github_repo" {
  description = "이 환경으로 자동 배포하는 GitHub 저장소(<owner>/<repo>)"
  type        = string
  default     = "HEUNG-BAE-LEE/mcp-studio"
}

variable "github_oidc_subject_prefix" {
  description = "GitHub OIDC 토큰 subject 의 저장소 부분. 이 저장소는 ID 고정 형식이다(gh api repos/<repo>/actions/oidc/customization/sub)"
  type        = string
  default     = "repo:HEUNG-BAE-LEE@23379622/mcp-studio@1312471061"
}

variable "deploy_branches" {
  description = "이 환경으로 자동 배포하는 브랜치. staging 은 dev 머지마다 올라간다"
  type        = list(string)
  default     = ["dev"]
}

variable "extra_tags" {
  type    = map(string)
  default = {}
}

variable "internet_lockdown" {
  description = <<-EOT
    true 면 레거시 서브넷의 인터넷 아웃바운드를 막는다. 2단계로 쓴다.
      1) false 로 apply → 레거시 반입(apt·pip 이 인터넷을 써야 한다)
      2) true  로 다시 apply → 밀봉
    폐쇄망 구축도 실제로 "반입 후 밀봉" 순서로 진행된다.
  EOT
  type        = bool
  default     = false
}

variable "vm_size" {
  type    = string
  default = "Standard_B2s"
}

variable "admin_ssh_public_key" {
  description = "VM 관리자 공개키. 접속 경로는 없다(공인 IP 없음) — 형식상 필요"
  type        = string
}

variable "pg_sku" {
  type    = string
  default = "B_Standard_B1ms"
}

variable "kv_public_during_apply" {
  description = "Key Vault 공개 접근. 이 구독은 정책으로 금지돼 있어 false 가 기본이다(그때 비밀값은 terraform 출력으로만 전달)"
  type        = bool
  default     = false
}

variable "container_image" {
  description = "첫 apply 는 자리표시자. 실제 이미지는 배포 스크립트가 az containerapp update 로 바꾼다"
  type        = string
  default     = "mcr.microsoft.com/k8se/quickstart:latest"
}

variable "allowed_cidrs" {
  description = "이음 콘솔에 들어올 수 있는 대역(DMZ F/W 모사). 비우면 아무도 못 들어온다"
  type        = list(string)
  validation {
    condition     = length(var.allowed_cidrs) > 0 && !contains(var.allowed_cidrs, "0.0.0.0/0")
    error_message = "허용 대역을 하나 이상, 0.0.0.0/0 이 아닌 값으로 지정할 것 — 콘솔은 인증 없이 열려 있다."
  }
}
