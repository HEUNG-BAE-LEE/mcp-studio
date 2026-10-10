# 가상조달기관 + 이음 — KT Cloud 공공존 구조를 Azure 로 재현

공공기관이 KT Cloud 공공 클라우드(G-Cloud)를 쓸 때의 구조를 **Azure 위에 그대로 그려 본** 시연 환경이다.
레거시(가상조달기관 CTLG·DHGW·FINL·STCK + 레거시 DB)는 "기관 업무망", 이음은 "공공존 서비스 계층" 자리에 놓인다.

> **먼저 밝혀 둘 것.** 재현한 것은 **아키텍처 패턴**이지 규제상 효력이 아니다. Azure 가 받은 CSAP 는 하등급(2024-12)뿐이고,
> 공공 전용 물리 상면·국내 CC 인증 H/W 방화벽·국가정보통신망 직결은 Azure 로 재현할 수 없다. 실제 공공 서비스는 시스템 등급에 맞는
> 인증 클라우드로 옮기는 것을 전제로 한다.

## KT Cloud 공공존 → Azure 대응

KT 쪽은 KT G-Cloud 사용자 Guide V1.3(2022.10)·D1 Server Guide·KT Cloud 보안백서(2021.3) 공개본 기준이다.

| KT G-Cloud 구성 (공개 매뉴얼) | 이 스택 | 비고 |
|---|---|---|
| 천안 CDC 공공 전용 존 | koreacentral + 전용 리소스 그룹 | 물리 분리 아님 — 논리 분리 |
| DMZ Tier / Private Tier (D1: Tier = /24 가상 서브넷) | `snet-pps-aca` (이음), `snet-pps-pg` (DB) | Tier 개념을 서브넷으로 |
| 기관 전산실 → 전용회선/VPN/CIP-Hybrid → 외부연동 F/W → Private | `snet-pps-legacy` + `nsg-pps-legacy` (이음 서브넷에서 18001~18004 만 허용) | **전용회선 연결형**을 같은 VNet 안 경로로 모사 |
| DMZ F/W · Private F/W · 외부연동 F/W (보안 매니지드) | Container Apps ingress IP 제한 · `nsg-pps-pg` · `nsg-pps-legacy` | SW 규칙. CC 인증 H/W 아님 |
| VR(가상라우터) NAT / Port Forwarding | 레거시 VM 공인 IP 없음, 관리 채널(run-command)만 | 반입 경로를 하나로 |
| DBaaS (공공존 MySQL — PostgreSQL 관리형 제공 여부는 공개 자료로 미확인) | PostgreSQL Flexible Server, 위임 서브넷, 공개 접근 차단 | |
| KMS (자체 상품 미확인, 파트너 CloudKey HSM/KMS) | Key Vault + 사설 엔드포인트 | |
| Watch / ESM 관제 | Log Analytics | 24시간 관제는 재현 안 함 |
| 반입 후 밀봉 | `internet_lockdown` 2단계 apply | |

N2SF 기준으로 보면 이 구성은 **S·O 등급 시스템을 공공 클라우드에 두고 업무망과 전용회선으로 잇는 형태**다.
C 등급(망분리 구역)은 이음 온보딩에서도 "설치형 게이트웨이(2차)"로 잠가 둔다.

## 만들어지는 것

`vnet-pps`(10.70.0.0/16) · 서브넷 4 · NSG 2 · 레거시 VM 1(B2s, 10.70.1.10, 22시 자동 종료) · PostgreSQL Flexible(B1ms, `pps_legacy`) ·
Key Vault + 사설 엔드포인트 · Log Analytics · Container Apps 환경(VNet 연동) + 이음 앱 1 · 관리 ID(AcrPull).
리소스 그룹과 ACR(**공유 자원 — 만들거나 지우지 않는다**)은 기존 것을 참조만 한다.

## 모듈 구조 — 재사용

```
infra/pps/
├── main.tf            모듈 조합(이 시연 환경)
├── variables.tf       바꿔 쓸 값: 대역 · 서브넷 · 포트 · VM/DB 크기 · 허용 IP · 밀봉 여부
├── modules/
│   ├── network/       VNet · 서브넷 4(app · legacy · db · pe) · NSG 2(외부연동 F/W · Private F/W)
│   ├── legacy-vm/     공인 IP 없는 레거시 서버 1대(cloud-init 은 배포판 패키지만, 자동 종료)
│   ├── legacy-db/     PostgreSQL Flexible(위임 서브넷 + Private DNS, 공개 접근 차단)
│   ├── vault/         Key Vault(RBAC · 사설 엔드포인트) + 비밀값 맵
│   └── ieum-app/      Container Apps 환경 + 앱 1(공유 ACR 을 관리 ID 로 pull, 허용 대역만 노출)
└── deploy_legacy.sh   레거시 소프트웨어 반입(관리 채널 run-command)
```

모듈은 서로를 모른다. 루트 `main.tf` 가 출력(서브넷 ID · FQDN · 비밀값)을 이어 붙인다. 그래서

- **같은 구성을 다른 기관 · 다른 구독에 올릴 때**: `terraform.tfvars` 의 `name_prefix` · `address_space` · `subnets` · `legacy_ports` 만 바꾸고
  상태 파일 키(`backend.hcl` 의 `key`)를 다르게 둔다. 같은 RG 에 두 벌이 공존해도 이름 · 대역이 겹치지 않는다.
- **레거시만 필요할 때**: 루트에서 `module "ieum"` 을 빼면 network · legacy-vm · legacy-db · vault 만 올라간다.
- **레거시 서버를 여러 대로 나눌 때**: `module "legacy_vm"` 을 `for_each` 로 감싸 시스템별로 한 대씩 둔다(`private_ip` 만 다르게).

## staging 과 자동 배포(CI/CD)

이 스택이 **staging** 이다(`environment = "staging"`, 모든 리소스 태그 `env=staging`). dev 에 머지될 때마다
`.github/workflows/deploy-aca.yml` 이 staging 으로 자동 배포한다.

```
dev 머지 ─▶ GitHub Actions ─(OIDC)─▶ Azure 로그인(gh-…-pps-staging 앱)
              │ docker build · push ─▶ wtembed10835/ieum-pps:<커밋 SHA>
              │ az containerapp update ─▶ ca-pps-ieum 새 리비전
              └ 리비전 상태 확인(Healthy · Running) — 실패하면 워크플로가 빨간색
```

- **로그인은 비밀값 없이 한다.** `modules/github-oidc` 가 Entra 앱과 연합 자격 증명을 만든다. GitHub 이 발급한 단기 토큰의 subject 가
  `repo:HEUNG-BAE-LEE/mcp-studio:ref:refs/heads/dev` 와 정확히 같을 때만 Azure 로그인으로 바뀐다. 다른 브랜치 · 포크 · PR 은 거절된다.
- **권한은 리소스 단위 넷뿐이다.** 공유 ACR 에 push(AcrPush) · 읽기(Reader), `ca-pps-ieum` 수정(Contributor), 앱 환경 읽기(Reader).
  같은 RG 의 다른 서비스 리소스는 바꿀 수 없다. ACR 안 빌드(`az acr build`)는 레지스트리 전체 권한이 필요해 쓰지 않는다.
- **워크플로에 `environment:` 를 달지 않는다.** 달면 토큰의 subject 가 `environment:<이름>` 으로 바뀌어 위 자격 증명과 맞지 않는다.
- **헬스체크는 HTTP 가 아니라 리비전 상태로 한다.** staging 은 허용 IP 에서만 열리므로(콘솔이 인증 없이 열려 있다) 러너가 두드릴 수 없다.
- 레거시 VM 은 자동 배포 대상이 아니다. 밀봉돼 있어(인터넷 아웃바운드 차단) pip 설치가 안 된다 — 레거시를 바꿨으면
  `internet_lockdown=false` 로 apply → `deploy_legacy.sh` → 다시 밀봉한다.
- **prod 를 따로 둘 때**: 같은 모듈로 `name_prefix = "pps-prod"`, `environment = "prod"`, `deploy_branches = ["master"]`,
  상태 키 `pps-prod.tfstate` 로 한 벌 더 올리고, `deploy-aca-prod.yml` 의 대상과 client-id 를 그 출력으로 바꾼다.

## 순서

```bash
# 0. 상태 저장소 (최초 1회) — 이전 mcp-studio 저장소는 2026-09-21 삭제됐다
az storage account create -n sttfstateieumpps -g $RG -l koreacentral \
  --sku Standard_LRS --kind StorageV2 --min-tls-version TLS1_2 --allow-blob-public-access false
# 상태 저장소 데이터 평면 권한(반영에 몇 분 걸린다 — 그동안 init 이 403 을 낸다)
az role assignment create --assignee-object-id $(az ad signed-in-user show --query id -o tsv) --assignee-principal-type User \
  --role "Storage Blob Data Contributor" --scope $(az storage account show -n sttfstateieumpps -g $RG --query id -o tsv)
az storage container create -n tfstate --account-name sttfstateieumpps --auth-mode login
cp backend.hcl.example backend.hcl && cp terraform.tfvars.example terraform.tfvars   # 공개키·허용 IP 채우기

# 1. 반입 단계
terraform init -backend-config=backend.hcl
terraform plan -out tf.plan            # 이 스택(pps-*) 외 리소스가 계획에 없어야 한다
terraform apply tf.plan

# 2. 이음 이미지 — 로컬 Docker 없이 ACR 클라우드 빌드
SHA=$(git rev-parse --short HEAD)
az acr build -r $ACR --image ieum-pps:$SHA --file ../../Dockerfile ../..
az containerapp update -n $(terraform output -raw container_app_name) -g $RG \
  --image $ACR.azurecr.io/ieum-pps:$SHA

# 3. 레거시 반입 (관리 채널)
#    비밀번호는 terraform 민감 출력에서 읽는다(Key Vault 는 공개 접근 금지 정책으로 이 PC 에서 닿지 않는다)
./deploy_legacy.sh --rg $RG --vm $(terraform output -raw legacy_vm_name) --pg $(terraform output -raw pg_fqdn)

# 4. 밀봉 — 레거시 인터넷 아웃바운드 차단. 다시 apply 해도 풀리지 않게 terraform.tfvars 에 internet_lockdown = true 를 남긴다
terraform apply -var internet_lockdown=true
az vm run-command invoke -g $RG -n $(terraform output -raw legacy_vm_name) \
  --command-id RunShellScript --scripts "curl -s -m 5 https://www.google.com >/dev/null && echo OPEN || echo BLOCKED"   # 기대: BLOCKED
```

이음 콘솔 → 원본 시스템 → **한 번에 연결** 을 열면 위자드의 시연 값이 이 환경을 가리킨다(`IEUM_DEMO_*`, `PPS_LEGACY_DSN` 환경변수).
클라우드 채널의 가상 VM 4대는 모두 레거시 VM(`10.70.1.10`)의 포트로 이어지고, DB 는 사설 FQDN · 읽기 전용 계정(`pps_reader`)이다.

### 구독 정책과 맞춘 것 (2026-10-10 실제 apply 에서 확인)
- **Key Vault 공개 접근 금지**(`RequestDisallowedByPolicy`) — 사설 엔드포인트 전용으로 만들고, 비밀값은 terraform 민감 출력으로만 넘긴다.
- **VM 시스템 관리 ID 자동 부여**(Azure Policy · Defender 확장) — `ignore_changes = [identity]` 로 정책과 싸우지 않는다.
- 배포된 묶음의 MCP 서버는 컨테이너 안 프로세스(`127.0.0.1:81xx`)라 Azure 밖에서 직접 부를 수 없다(이음 런타임의 현재 설계).

## 비용과 정리

상시 비용은 PostgreSQL B1ms · Container Apps 1 레플리카 · Key Vault 사설 엔드포인트가 대부분이다. VM 은 22시에 꺼진다.
정리는 `terraform destroy` — 리소스 그룹과 ACR 은 이 스택 소유가 아니라 남는다. 상태 저장소 계정은 손으로 지운다.
