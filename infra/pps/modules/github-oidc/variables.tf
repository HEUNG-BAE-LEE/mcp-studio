variable "display_name" {
  description = "Entra 앱 등록 이름"
  type        = string
}
variable "github_repo" {
  description = "<owner>/<repo>"
  type        = string
}
variable "subject_prefix" {
  description = <<-EOT
    토큰 subject 의 저장소 부분. 저장소 설정에 따라 둘 중 하나다 — 틀리면 AADSTS700213 으로 로그인이 거절된다.
      기본         repo:<owner>/<repo>
      ID 고정 형식  repo:<owner>@<owner_id>/<repo>@<repo_id>   (use_immutable_subject = true)
    확인: gh api repos/<owner>/<repo>/actions/oidc/customization/sub 의 sub_claim_prefix
  EOT
  type        = string
}
variable "branches" {
  description = "로그인을 허용할 브랜치. 여기 없는 브랜치의 워크플로는 Azure 에 들어오지 못한다"
  type        = list(string)
}
variable "role_assignments" {
  description = "이름 → { scope = 리소스 ID, role = 기본 제공 역할 이름 }. 리소스 단위로 좁게 준다"
  type = map(object({
    scope = string
    role  = string
  }))
}
