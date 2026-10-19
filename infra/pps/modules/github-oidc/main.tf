# GitHub Actions → Azure 로그인(OIDC 연합 자격 증명). 비밀번호 · 키를 저장소 시크릿에 두지 않는다.
#
# 흐름: 워크플로가 GitHub 에서 단기 토큰(subject = <subject_prefix>:ref:refs/heads/<branch>)을 받고,
#       Azure 는 아래 연합 자격 증명과 subject 가 정확히 같을 때만 그 토큰을 Azure 로그인으로 바꿔 준다.
#       다른 브랜치 · 포크 · PR 에서 온 토큰은 거절된다.
# 권한은 role_assignments 로 준 범위(리소스 단위)까지만이다.

resource "azuread_application_registration" "this" {
  display_name = var.display_name
}

resource "azuread_service_principal" "this" {
  client_id = azuread_application_registration.this.client_id
}

resource "azuread_application_federated_identity_credential" "branch" {
  for_each       = toset(var.branches)
  application_id = azuread_application_registration.this.id
  display_name   = "github-${replace(each.value, "/", "-")}"
  description    = "${var.github_repo} 의 ${each.value} 브랜치 워크플로"
  audiences      = ["api://AzureADTokenExchange"]
  issuer         = "https://token.actions.githubusercontent.com"
  subject        = "${var.subject_prefix}:ref:refs/heads/${each.value}"
}

resource "azurerm_role_assignment" "this" {
  for_each             = var.role_assignments
  scope                = each.value.scope
  role_definition_name = each.value.role
  principal_id         = azuread_service_principal.this.object_id
  principal_type       = "ServicePrincipal"
}
