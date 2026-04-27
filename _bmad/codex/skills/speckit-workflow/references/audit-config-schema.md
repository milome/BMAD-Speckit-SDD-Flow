# audit_convergence 閰嶇疆璇存槑锛圙AP-CONV-10锛?
## 閰嶇疆浣嶇疆涓庝紭鍏堢骇

| 浼樺厛绾?| 鏉ユ簮 | 璇存槑 |
|--------|------|------|
| 1 | CLI 鍙傛暟 `--audit-mode` | 鍗曟鍛戒护瑕嗙洊 |
| 2 | 椤圭洰 `_bmad/_config/speckit.yaml` | 椤圭洰绾ч粯璁?|
| 3 | skill 榛樿 | standard |

## 鍙栧€?
| 鍊?| 璇存槑 | 閫傜敤 |
|----|------|------|
| strict | 杩炵画 3 杞棤 gap + 鎵瑰垽瀹¤鍛?>50% | 瀹炴柦鍚庡璁°€佸彂甯冨墠闂ㄦ帶 |
| standard | 鍗曟 + 鎵瑰垽瀹¤鍛?>50% | 榛樿锛屽父瑙勫紑鍙?|
| simple | 鍗曟閫氳繃鍗冲彲锛屽彲鐪佺暐鎵瑰垽瀹¤鍛?| **浠?CLI 鍙€?*锛屽揩閫熼獙璇侊紝涓嶄繚璇佽川閲?|

## 绂佹浜嬮」

**椤圭洰绾?simple 绂佹**锛歚_bmad/_config/speckit.yaml` 涓笉寰楄缃?`audit_convergence: simple`銆傝嫢璁剧疆锛宻kill 鍏ュ彛鎴栨牎楠岃剼鏈簲鎷掔粷骞舵姤閿欙紙exit code 鈮?0锛夈€?
**鏍￠獙鑴氭湰**锛歚_bmad/speckit/scripts/powershell/validate-audit-config.ps1`銆傛墽琛岃鑴氭湰鏃讹紝鑻ラ」鐩?config 鍚?`audit_convergence: simple`锛岄鏈熸姤閿欎笖 exit code 鈮?0銆?
## 楠屾敹绀轰緥

```powershell
# 1. 鍐欏叆 _bmad/_config/speckit.yaml 骞惰缃?audit_convergence: simple
Set-Content -Path "config\speckit.yaml" -Value "audit_convergence: simple"

# 2. 鎵ц鏍￠獙鑴氭湰
& "_bmad\scripts\bmad-speckit\powershell\validate-audit-config.ps1"

# 3. 棰勬湡锛?LASTEXITCODE -ne 0锛屼笖杈撳嚭鍚?AUDIT_CONVERGENCE_SIMPLE_FORBIDDEN
```
