# 정상 테마 APK와 생성기 템플릿 비교

- 정상 APK: 68개 엔트리, AndroidManifest.xml 2680바이트, classes.dex 존재: True
- 현재 템플릿: 41개 엔트리, AndroidManifest.xml 1272바이트, classes.dex 존재: False

## 정상 APK에만 있는 파일

- `classes.dex`
- `res/color/theme_description_color_selector.xml`
- `res/color/theme_feature_gift_color_selector.xml`
- `res/color/theme_feature_music_color_selector.xml`
- `res/color/theme_feature_primary_color_selector.xml`
- `res/color/theme_paragraph_color_selector.xml`
- `res/color/theme_passcode_keypad_color_selector.xml`
- `res/color/theme_title_color_selector.xml`
- `res/drawable-v21/theme_body_cell_color_selector.xml`
- `res/drawable-v21/theme_passcode_keypad_pressed_background_color_selector.xml`
- `res/drawable-xxhdpi-v4/btn_mainactivity_n.9.png`
- `res/drawable-xxhdpi-v4/btn_mainactivity_p.9.png`
- `res/drawable-xxhdpi-v4/icon.png`
- `res/drawable-xxhdpi-v4/maintab_ico_discovery.png`
- `res/drawable-xxhdpi-v4/maintab_ico_discovery_focused.png`
- `res/drawable-xxhdpi-v4/theme_maintab_ico_game_focused_image.png`
- `res/drawable-xxhdpi-v4/theme_maintab_ico_game_image.png`
- `res/drawable/btn_mainactivity.xml`
- `res/drawable/theme_background_image.xml`
- `res/drawable/theme_body_cell_color_selector.xml`
- `res/drawable/theme_find_add_friend_button_image_selector.xml`
- `res/drawable/theme_notification_background.xml`
- `res/drawable/theme_passcode_keypad_background_color_land.xml`
- `res/drawable/theme_tab_browse_icon.xml`
- `res/drawable/theme_tab_chats_icon.xml`
- `res/drawable/theme_tab_find_icon.xml`
- `res/drawable/theme_tab_friend_icon.xml`
- `res/drawable/theme_tab_game_icon.xml`
- `res/drawable/theme_tab_more_icon.xml`
- `res/drawable/theme_tab_piccoma_icon.xml`
- `res/layout/main_activity.xml`

## 결론

정상 APK는 실행 코드(classes.dex), 레이아웃, XML 색상/드로어블 리소스를 포함하지만 현재 템플릿은 포함하지 않습니다. 단, 단일 APK 비교만으로 어떤 요소가 필수인지는 확정할 수 없습니다.

현재 웹 생성기는 template.apk의 리소스 ID 및 색상 마커에 의존하므로 정상 APK를 단순히 template.apk로 교체하면 오류가 납니다. 정상 APK의 소스 프로젝트 또는 카카오 공식 샘플 프로젝트를 기반으로 새 템플릿을 빌드하고 마커/리소스 경로를 맞춰야 합니다.