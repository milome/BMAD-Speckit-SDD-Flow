# Omission Pattern Library

鏈簱鐢ㄤ簬鏀舵暃 `readiness gate`銆乣ambiguity linter`銆佸悗缁?checklist / audit prompt 鐨勯仐婕忚涔夈€傜洰鏍囦笉鏄仛娉涘寲璇█瀹℃煡锛岃€屾槸灏介噺鏃╁湴鎶撲綇浼氳 `P0 journey` 璺戜笉閫氱殑楂樹环鍊肩己鍙ｃ€?
## 1. Missing Completion State

- 鐥囩姸锛氬彧鍐欌€滃畬鎴愨€濃€渞eady鈥濃€渄one鈥濓紝娌℃湁瀹氫箟浠€涔堟墠绠楃敤鎴峰彲瑙佸畬鎴愩€?- 甯歌鍚庢灉锛氭ā鍧楀疄鐜板畬鎴愶紝浣嗕笟鍔″畬鎴愭€佹湭瀹氫箟锛孍2E 鏃犳硶楠屾敹銆?- 榛樿澶勭悊锛氬垽涓?definition gap锛屽洖鍒?clarify / readiness銆?
## 2. Missing Failure Trigger

- 鐥囩姸锛氬彧瀹氫箟鎴愬姛璺緞锛屾病鏈夎鏄庡け璐ユ潯浠躲€佸洖婊氭潯浠躲€佸憡璀︽潯浠躲€?- 甯歌鍚庢灉锛歴moke 閫氳繃鏃剁湅浼兼甯革紝鐪熷疄澶辫触璺緞鏃犱汉楠岃瘉銆?- 榛樿澶勭悊锛氳ˉ鍏?failure matrix 鎴?deferred reason锛屽啀杩涘叆 tasks / implement銆?
## 3. Missing Permission Boundary

- 鐥囩姸锛氭湭瀹氫箟璋佽兘鍋氥€佽皝涓嶈兘鍋氾紝鎴栨潈闄愬垏鎹㈢偣琚渷鐣ャ€?- 甯歌鍚庢灉锛氬疄鐜颁笌 smoke 璺緞涓嶄竴鑷达紝绾夸笂鍏ュ彛鏃犳硶鐪熸浣跨敤銆?- 榛樿澶勭悊锛氬垽涓?blocker锛岃Е鍙?re-readiness銆?
## 4. Missing Fixture Cleanup

- 鐥囩姸锛氬啓浜?fixture / seed data锛屼絾娌℃湁鐢熷懡鍛ㄦ湡銆佹竻鐞嗐€侀殧绂昏鍒欍€?- 甯歌鍚庢灉锛歴moke / full E2E 鍏变韩鑴忕姸鎬侊紝CI 鍋跺彂澶辫触銆?- 榛樿澶勭悊锛氳ˉ fixture lifecycle 鍜?cleanup contract銆?
## 5. Missing Smoke Assertion

- 鐥囩姸锛氬彧璇粹€滅敓鎴?smoke 娴嬭瘯鈥濓紝娌℃湁鏂█鐩爣銆侀獙璇佸懡浠ゃ€侀鏈熺粨鏋溿€?- 甯歌鍚庢灉锛氭湁娴嬭瘯鏂囦欢浣嗘病鏈夎瘉鏄庯紝Journey 浠嶄笉鍙敹鍙ｃ€?- 榛樿澶勭悊锛氳ˉ `Evidence Type`銆乣Verification Command`銆乣Closure Note`銆?
## 6. Module Complete But Journey Not Runnable

- 鐥囩姸锛氬墠绔€佸悗绔€佹暟鎹簱鍚勮嚜瀹屾垚锛屼絾鐪熷疄鍏ュ彛浠嶇劧娌℃湁鍙窇閫氳矾寰勩€?- 甯歌鍚庢灉锛氶暱浠诲姟鍚庡姛鑳界偣涓㈠け銆侀泦鎴愰摼鏂銆乧losure 鏃犳硶鍐欍€?- 榛樿澶勭悊锛氬湪 tasks / implement 瀹¤涓綔涓?blocker锛岀姝㈠甯冮€氳繃銆?
## 7. Silent Assumption Markers

- 楂橀闄╃煭璇細`TODO`銆乣TBD`銆乣FIXME`銆乣???`銆乣鍚庣画琛ラ綈`銆乣鍚庣画鑰冭檻`銆乣榛樿濡傛`銆乣鏆備笉澶勭悊`銆乣later wire in`
- 榛樿澶勭悊锛歳eadiness gate / ambiguity linter 鐩存帴鎶ュ嚭銆?
## Tooling Notes

- `readiness_gate.py`锛氫富瑕佹姄 blocker words銆乴edger 瀹屾暣鎬с€乧losure completeness銆乫ixture/env placeholder銆?- `ambiguity_linter.py`锛氫富瑕佹姄 unresolved markers銆乻ilent assumptions銆乧ompletion / role placeholders銆?- 鍚庣画 `speckit.checklist` / audit prompts 搴斾紭鍏堝紩鐢ㄦ湰搴撲腑鐨?blocker 绫荤洰锛岃€屼笉鏄娊璞″湴璇粹€滄枃妗ｄ笉瀹屾暣鈥濄€?
