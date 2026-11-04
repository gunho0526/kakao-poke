# 카카오톡 테마 미표시 문제: 조사 결과

## 실제 확인된 내용
- 업로드된 `pokemon-dark-custom-1.apk`와 저장소의 `template.apk`의 `AndroidManifest.xml`은 바이트 단위로 동일합니다.
- `android.js`는 `template.apk`의 Manifest를 수정하지 않고 이미지와 `resources.arsc`를 교체한 뒤 APK를 다시 서명합니다.
- 따라서 이미지 조립 단계에서 Manifest가 사라진 것이 원인은 아닙니다.
- 템플릿 Manifest에는 `<application>`이 있지만 activity/service/receiver 및 별도 테마 식별 메타데이터는 확인되지 않았습니다.
- **이 정보만으로 카카오톡이 테마를 인식하지 못하는 정확한 이유를 확정할 수 없습니다.**

## 해결을 위해 필요한 다음 단계
1. 실제 카카오톡 테마 목록에 표시되는 정상 APK 1개를 확보합니다.
2. Android SDK `aapt2 dump xmltree` 또는 `apkanalyzer manifest print`로 두 APK의 Manifest를 비교합니다.
3. `resources.arsc`의 테마 리소스 식별자와 패키지/앱 라벨도 비교합니다.
4. 공식 테마 템플릿 또는 정상 작동하는 프로젝트를 기반으로 `template.apk`를 다시 빌드합니다.
5. `node check-theme.mjs template.apk`로 기본 구조를 점검하고, 실제 안드로이드 카카오톡에서 표시 여부를 확인합니다.

## 주의
단순히 intent-filter나 activity를 임의로 추가해도 해결된다는 근거는 없습니다. 기존 웹 생성 기능은 변경하지 않았습니다.
