# 인프라 (Azure Container Apps)

관리자 화면과 백엔드를 **컨테이너 하나**로 묶어 Azure Container Apps 에 올린다.
`master` 에 머지되면 GitHub Actions 가 이미지를 다시 빌드하고 앱의 이미지 태그를 바꾼다.

## 어디에 만들어지는가

| 항목 | 값 |
|---|---|
| 구독 | `sub-open-axd-personal-01` (개인) |
| 리소스 그룹 | `azure_test-a89a8649-741-rg001` (기존 것을 쓴다, 만들지 않는다) |
| 리전 | koreacentral |
| 레지스트리 | `wtembed10835.azurecr.io` (기존 것을 쓴다) |

회사 프로젝트 구독(`sub-open-axd-project-01`)에는 올라가지 않는다. `variables.tf` 의
`subscription_id` validation 이 그 구독 ID 를 거부한다.

## 만들어지는 것

- Log Analytics 워크스페이스 — 컨테이너 표준출력 목적지
- Container Apps 환경 + Container App (외부 ingress, 8000 포트)
- App 의 시스템 관리 ID + ACR `AcrPull` 역할
- GitHub Actions 용 사용자 할당 관리 ID + 연합 자격 증명(OIDC) + 역할 2개

## 상태 파일

`sttfstatemcpstudio` 스토리지 계정의 `tfstate` 컨테이너에 있다(`versions.tf`).
Terraform 이 이 계정을 관리하지는 않는다 — 상태를 담는 그릇을 상태로 관리하면
순환이 된다. 이미 만들어져 있으므로 아래는 **새 환경을 처음 세울 때만** 필요하다.

```bash
az storage account create -n <계정> -g <리소스그룹> -l koreacentral \
  --sku Standard_LRS --kind StorageV2 --min-tls-version TLS1_2 \
  --allow-blob-public-access false
az storage container create -n tfstate --account-name <계정> --auth-mode login
# 계정 소유자여도 데이터 평면 권한은 따로다. 없으면 init 이 403 을 낸다.
az role assignment create --assignee <본인 objectId> \
  --role "Storage Blob Data Contributor" \
  --scope $(az storage account show -n <계정> -g <리소스그룹> --query id -o tsv)
```

## 처음 올릴 때

```bash
cd infra/terraform
terraform init
terraform apply          # 자리표시자 이미지로 앱이 먼저 생긴다
terraform output          # 워크플로에 넣을 client/tenant/subscription id
```

`terraform apply` 직후의 앱은 공개 자리표시자 이미지를 띄운다. 실제 이미지는
`master` 푸시(또는 Actions 의 `Run workflow`)가 올린다. 수동으로 한 번 올리려면:

```bash
az acr build -r wtembed10835 -t mcp-studio:manual .      # 저장소 루트에서
az containerapp update -n mcp-studio -g azure_test-a89a8649-741-rg001 \
  --image wtembed10835.azurecr.io/mcp-studio:manual
```

## LLM 콘솔

기본 apply 에서는 Azure OpenAI 값을 넣지 않는다. 개인 리소스 그룹의
`az-openai-wt-test` 는 공용 네트워크 접근이 꺼져 있어(private endpoint 전용)
Container Apps 에서 닿지 않기 때문이다. 그 상태에서도 수집·액션 화면은 동작하고
LLM 콘솔만 응답하지 않는다.

켜는 방법은 둘이다.

1. 공용 접근이 가능한 Azure OpenAI 를 `terraform.tfvars` 에 적는다
   (`terraform.tfvars.example` 참고). 키는 Container Apps 시크릿으로 들어간다.
2. `az-openai-wt-test` 를 계속 쓰려면 Container Apps 환경을 VNet 에 넣고 private
   endpoint 를 바라보게 해야 한다. 코드 변경이 필요하고 비용 등급도 올라간다.

## 알아둘 것

- **이미지 태그는 Terraform 이 관리하지 않는다.** `lifecycle.ignore_changes` 로 빼 뒀다.
  안 그러면 `apply` 한 번에 배포가 과거 이미지로 굴러간다.
- **SQLite 는 컨테이너와 함께 사라진다.** 기동 시 `seed()` 가 촬영용 데이터를 다시
  만들지만, 실행 중 수집한 결과는 리비전이 바뀌면 없어진다. 유지가 필요하면
  `/app/data` 에 Azure Files 를 마운트한다.
- **`max_replicas` 는 1 이다.** SQLite 파일 하나를 쓰므로 복제본이 늘면 DB 가 갈린다.
- **`min_replicas` 는 0 이다.** 요청이 없으면 0 으로 줄어 과금이 없고, 첫 요청이
  수초 늦다. 촬영 직전에는 1 로 올려 두는 편이 낫다.
- 상태 파일은 로컬에 있다. 두 사람 이상이 apply 하게 되면 `versions.tf` 의
  `backend "azurerm"` 주석을 열고 `terraform init -migrate-state` 를 돌린다.
