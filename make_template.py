"""카톡 안드로이드 테마 템플릿 프로젝트를 만든다 (GitHub Actions 에서 실행).
   만든 뒤 gradle 로 구우면 template.apk 가 나오고, 웹페이지가 거기에 그림과 색을 끼워 넣는다.

   - 패키지: com.kakao.talk.theme.pokemon
   - 카톡이 테마로 알아보도록 com.kakao.talk.v2.theme 권한과
     com.kakao.talk.theme.action.MAIN 을 받는 화면을 넣는다 (카카오 공식 테마 틀과 같은 구성)
   - 카톡 26.9.0 샘플 기준: 새 색 7칸, 지금/통화/지역 탭 아이콘, theme-adv 연결 파일 포함
   - 색 49칸은 #FFA56Bxx 표식 색으로, 테마 이름은 ~ 64자로 구워 두고 페이지가 같은 길이로 덮어쓴다
"""
import json, os, struct, zlib

PKG = 'com.kakao.talk.theme.pokemon'
NAMES = ["theme_background_color", "theme_header_color", "theme_header_cell_color", "theme_tab_bannerbadge_background_color", "theme_section_title_color", "theme_title_color", "theme_title_pressed_color", "theme_paragraph_color", "theme_paragraph_pressed_color", "theme_description_color", "theme_description_pressed_color", "theme_body_cell_color", "theme_body_cell_pressed_color", "theme_body_cell_border_color", "theme_body_secondary_cell_color", "theme_feature_primary_color", "theme_feature_primary_pressed_color", "theme_feature_browse_tab_color", "theme_feature_browse_tab_focused_color", "theme_maintab_cell_color", "theme_chatroom_background_color", "theme_chatroom_unread_count_color", "theme_chatroom_input_bar_color", "theme_chatroom_input_bar_background_color", "theme_chatroom_input_bar_menu_icon_color", "theme_chatroom_input_bar_send_button_color", "theme_chatroom_input_bar_send_icon_color", "theme_direct_share_color", "theme_direct_share_button_color", "theme_direct_share_background_color", "theme_notification_color", "theme_notification_background_color", "theme_notification_background_pressed_color", "theme_passcode_color", "theme_passcode_background_color", "theme_passcode_keypad_color", "theme_passcode_keypad_pressed_color", "theme_passcode_keypad_background_color", "theme_passcode_keypad_pressed_background_color", "theme_passcode_pattern_line_color", "theme_chatroom_bubble_me_color", "theme_chatroom_bubble_you_color", "theme_tab_lightbannerbadge_background_color", "theme_chatroom_input_bar_menu_button_color", "theme_button_background_color", "theme_button_pressed_background_color", "theme_button_selected_background_color", "theme_navigationbar_background_color", "theme_navigationrail_background_color"]
DRAWABLES = ["theme_background_image.png", "theme_chatroom_background_image.png", "theme_chatroom_bubble_me_01_image.9.png", "theme_chatroom_bubble_me_02_image.9.png", "theme_chatroom_bubble_you_01_image.9.png", "theme_chatroom_bubble_you_02_image.9.png", "theme_find_add_friend_button_image.png", "theme_find_add_friend_button_pressed_image.png", "theme_maintab_cell_image.png", "theme_maintab_ico_browse_focused_image.png", "theme_maintab_ico_browse_image.png", "theme_maintab_ico_chats_focused_image.png", "theme_maintab_ico_chats_image.png", "theme_maintab_ico_find_focused_image.png", "theme_maintab_ico_find_image.png", "theme_maintab_ico_friends_focused_image.png", "theme_maintab_ico_friends_image.png", "theme_maintab_ico_more_focused_image.png", "theme_maintab_ico_now_focused_image.png", "theme_maintab_ico_now_image.png", "theme_maintab_ico_call_focused_image.png", "theme_maintab_ico_call_image.png", "theme_maintab_ico_local_focused_image.png", "theme_maintab_ico_local_image.png", "theme_maintab_ico_more_image.png", "theme_maintab_ico_piccoma_focused_image.png", "theme_maintab_ico_piccoma_image.png", "theme_maintab_ico_shopping_focused_image.png", "theme_maintab_ico_shopping_image.png", "theme_passcode_01_checked_image.png", "theme_passcode_01_image.png", "theme_passcode_02_checked_image.png", "theme_passcode_02_image.png", "theme_passcode_03_checked_image.png", "theme_passcode_03_image.png", "theme_passcode_04_checked_image.png", "theme_passcode_04_image.png", "theme_passcode_background_image.png", "theme_profile_01_image.png", "theme_profile_02_image.png", "theme_profile_03_image.png", "theme_splash_image.png"]
FILLER = '~' * 64
MARKS = ['#FFA56B%02X' % (i + 1) for i in range(len(NAMES))]
OUT = 'tpl'

def png(w, h, rgba):
    """그림 라이브러리 없이 단색 PNG 를 만든다"""
    raw = b''.join(b'\x00' + bytes(rgba) * w for _ in range(h))
    def chunk(t, d): return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw)) + chunk(b'IEND', b'')

def nine_src(w, h):
    """원본 9-patch: 1px 검은 테두리로 늘어날 줄(위, 왼쪽)과 글자 자리(아래, 오른쪽)를 표시"""
    W, H = w + 2, h + 2
    px = [[(0, 0, 0, 0)] * W for _ in range(H)]
    for y in range(1, H - 1):
        for x in range(1, W - 1): px[y][x] = (255, 255, 255, 255)
    px[0][W // 2] = (0, 0, 0, 255); px[H // 2][0] = (0, 0, 0, 255)
    for x in range(3, W - 3): px[H - 1][x] = (0, 0, 0, 255)
    for y in range(3, H - 3): px[y][W - 1] = (0, 0, 0, 255)
    raw = b''.join(b'\x00' + b''.join(bytes(p) for p in row) for row in px)
    def chunk(t, d): return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', W, H, 8, 6, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw)) + chunk(b'IEND', b'')

def write(path, data):
    path = os.path.join(OUT, path); os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'wb' if isinstance(data, bytes) else 'w', **({} if isinstance(data, bytes) else {'encoding': 'utf-8'})) as f: f.write(data)

write('settings.gradle', """pluginManagement { repositories { google(); mavenCentral(); gradlePluginPortal() } }
dependencyResolutionManagement { repositories { google(); mavenCentral() } }
rootProject.name = 'pokemon-theme'
""")
write('gradle.properties', 'org.gradle.jvmargs=-Xmx2g\nandroid.useAndroidX=false\n')
write('build.gradle', f"""plugins {{ id 'com.android.application' version '8.5.2' }}
android {{
    namespace '{PKG}'
    compileSdk 34
    defaultConfig {{
        applicationId '{PKG}'
        minSdk 24
        targetSdk 34
        versionCode 1
        versionName '10.5.0'
    }}
    androidResources {{ noCompress 'arsc' }}
    sourceSets {{ main {{ manifest.srcFile 'AndroidManifest.xml'; java.srcDirs = ['java']; res.srcDirs = ['res'] }} }}
    lint {{ abortOnError false; checkReleaseBuilds false }}
}}
""")
write('AndroidManifest.xml', f"""<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="com.kakao.talk.v2.theme" />
    <queries><package android:name="com.kakao.talk" /></queries>
    <application android:label="@string/app_name" android:icon="@mipmap/ic_launcher" android:allowBackup="true">
        <activity android:name=".MainActivity" android:exported="true" android:excludeFromRecents="true"
            android:theme="@android:style/Theme.Translucent.NoTitleBar">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
            <intent-filter>
                <action android:name="com.kakao.talk.theme.action.MAIN" />
            </intent-filter>
        </activity>
    </application>
</manifest>
""")
write('java/com/kakao/talk/theme/pokemon/MainActivity.java', f"""package {PKG};

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;

/** 열면 카톡 테마 설정으로 바로 넘어간다 */
public class MainActivity extends Activity {{
    @Override protected void onCreate(Bundle b) {{
        super.onCreate(b);
        try {{
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse("kakaotalk://settings/theme/" + getPackageName())));
        }} catch (Exception e) {{
            try {{ startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=com.kakao.talk"))); }} catch (Exception ignored) {{ }}
        }}
        finish();
    }}
}}
""")
colors = '\n'.join(f'    <color name="{n}">{m}</color>' for n, m in zip(NAMES, MARKS))
write('res/values/colors.xml', f'<?xml version="1.0" encoding="utf-8"?>\n<resources>\n{colors}\n</resources>\n')
write('res/values/strings.xml', f'<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <string name="app_name">{FILLER}</string>\n</resources>\n')
for d in DRAWABLES:
    if d.endswith('.9.png'): write('res/drawable-xxhdpi/' + d, nine_src(30, 30))
    else: write('res/drawable-xxhdpi/' + d, png(8, 8, (255, 255, 255, 255)))
# 카톡 26.9.0 공식 샘플의 theme-adv 연결 파일(selector) 그대로: 새 카톡은 탭 아이콘과 목록 칸을 이걸 거쳐 읽는다
ADV = {
"color/theme_description_color_selector.xml": "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<selector xmlns:android=\"http://schemas.android.com/apk/res/android\">\n    <item android:state_pressed=\"true\" android:color=\"@color/theme_description_pressed_color\" />\n    <item android:color=\"@color/theme_description_color\" />\n</selector>\n",
"color/theme_feature_gift_color_selector.xml": "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<selector xmlns:android=\"http://schemas.android.com/apk/res/android\">\n    <item android:state_pressed=\"true\" android:color=\"@color/theme_feature_primary_pressed_color\" />\n    <item android:color=\"@color/theme_feature_primary_color\" />\n</selector>\n",
"color/theme_feature_music_color_selector.xml": "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<selector xmlns:android=\"http://schemas.android.com/apk/res/android\">\n    <item android:state_pressed=\"true\" android:color=\"@color/theme_feature_primary_pressed_color\" />\n    <item android:color=\"@color/theme_feature_primary_color\" />\n</selector>\n",
"color/theme_feature_primary_color_selector.xml": "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<selector xmlns:android=\"http://schemas.android.com/apk/res/android\">\n    <item android:state_pressed=\"true\" android:color=\"@color/theme_feature_primary_pressed_color\" />\n    <item android:color=\"@color/theme_feature_primary_color\" />\n</selector>\n",
"color/theme_paragraph_color_selector.xml": "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<selector xmlns:android=\"http://schemas.android.com/apk/res/android\">\n    <item android:color=\"@color/theme_paragraph_pressed_color\" android:state_pressed=\"true\" />\n    <item android:color=\"@color/theme_paragraph_color\" />\n</selector>\n",
"color/theme_passcode_keypad_color_selector.xml": "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<selector xmlns:android=\"http://schemas.android.com/apk/res/android\">\n    <item android:color=\"@color/theme_passcode_keypad_pressed_color\" android:state_selected=\"true\" />\n    <item android:color=\"@color/theme_passcode_keypad_pressed_color\" android:state_pressed=\"true\" />\n    <item android:color=\"@color/theme_passcode_keypad_color\" />\n</selector>\n",
"color/theme_title_color_selector.xml": "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<selector xmlns:android=\"http://schemas.android.com/apk/res/android\">\n    <item android:state_pressed=\"true\" android:color=\"@color/theme_title_pressed_color\" />\n    <item android:color=\"@color/theme_title_color\" />\n</selector>\n",
"drawable/theme_background_image.xml": "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<shape xmlns:android=\"http://schemas.android.com/apk/res/android\">\n    <solid android:color=\"@color/theme_background_color\" />\n</shape>\n",
"drawable/theme_body_cell_color_selector.xml": "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<selector xmlns:android=\"http://schemas.android.com/apk/res/android\">\n    <item android:drawable=\"@color/theme_body_cell_pressed_color\" android:state_selected=\"true\" />\n    <item android:drawable=\"@color/theme_body_cell_pressed_color\" android:state_focused=\"true\" />\n    <item>\n        <ripple android:color=\"@color/theme_body_cell_pressed_color\">\n            <item android:id=\"@android:id/mask\" android:drawable=\"@android:color/white\" />\n            <item android:drawable=\"@color/theme_body_cell_color\" />\n        </ripple>\n    </item>\n</selector>\n",
"drawable/theme_find_add_friend_button_image_selector.xml": "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<selector xmlns:android=\"http://schemas.android.com/apk/res/android\">\n    <item\n            android:state_focused=\"true\"\n            android:state_pressed=\"false\"\n            android:drawable=\"@drawable/theme_find_add_friend_button_pressed_image\" />\n    <item\n            android:state_focused=\"true\"\n            android:state_pressed=\"true\"\n            android:drawable=\"@drawable/theme_find_add_friend_button_pressed_image\" />\n    <item\n            android:state_focused=\"false\"\n            android:state_pressed=\"true\"\n            android:drawable=\"@drawable/theme_find_add_friend_button_pressed_image\" />\n    <item\n            android:drawable=\"@drawable/theme_find_add_friend_button_image\" />\n\n</selector>\n",
"drawable/theme_notification_background.xml": "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<selector xmlns:android=\"http://schemas.android.com/apk/res/android\">\n    <item android:state_pressed=\"true\" android:drawable=\"@color/theme_notification_background_pressed_color\"/>\n    <item android:drawable=\"@color/theme_notification_background_color\" />\n</selector>\n",
"drawable/theme_passcode_keypad_background_color_land.xml": "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<shape xmlns:android=\"http://schemas.android.com/apk/res/android\">\n    <solid android:color=\"@color/theme_passcode_keypad_background_color\" />\n    <corners android:radius=\"4dp\" />\n</shape>\n",
"drawable/theme_passcode_keypad_pressed_background_color_selector.xml": "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<ripple xmlns:android=\"http://schemas.android.com/apk/res/android\"\n    android:color=\"@color/theme_passcode_keypad_pressed_background_color\">\n\n    <item\n        android:id=\"@android:id/mask\"\n        android:gravity=\"center\">\n        <shape android:shape=\"oval\">\n            <solid android:color=\"@color/theme_passcode_keypad_pressed_background_color\" />\n            <size\n                android:width=\"58dp\"\n                android:height=\"58dp\" />\n        </shape>\n    </item>\n\n    <item android:drawable=\"@android:color/transparent\" />\n\n</ripple>\n",
"drawable/theme_tab_call_icon.xml": "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<selector xmlns:android=\"http://schemas.android.com/apk/res/android\">\n    <item android:state_selected=\"true\" android:drawable=\"@drawable/theme_maintab_ico_call_focused_image\"/>\n    <item android:drawable=\"@drawable/theme_maintab_ico_call_image\"/>\n</selector>\n",
"drawable/theme_tab_chats_icon.xml": "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<selector xmlns:android=\"http://schemas.android.com/apk/res/android\" >\n    <item android:state_selected=\"true\" android:drawable=\"@drawable/theme_maintab_ico_chats_focused_image\"/>\n    <item android:drawable=\"@drawable/theme_maintab_ico_chats_image\"/>\n</selector>\n",
"drawable/theme_tab_friend_icon.xml": "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<selector xmlns:android=\"http://schemas.android.com/apk/res/android\" >\n    <item android:state_selected=\"true\" android:drawable=\"@drawable/theme_maintab_ico_friends_focused_image\"/>\n    <item android:drawable=\"@drawable/theme_maintab_ico_friends_image\"/>\n</selector>\n",
"drawable/theme_tab_more_icon.xml": "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<selector xmlns:android=\"http://schemas.android.com/apk/res/android\" >\n    <item android:state_selected=\"true\" android:drawable=\"@drawable/theme_maintab_ico_more_focused_image\"/>\n    <item android:drawable=\"@drawable/theme_maintab_ico_more_image\"/>\n</selector>\n",
"drawable/theme_tab_now_icon.xml": "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<selector xmlns:android=\"http://schemas.android.com/apk/res/android\">\n    <item android:drawable=\"@drawable/theme_maintab_ico_now_focused_image\" android:state_selected=\"true\" />\n    <item android:drawable=\"@drawable/theme_maintab_ico_now_image\" />\n</selector>\n",
"drawable/theme_tab_piccoma_icon.xml": "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<selector xmlns:android=\"http://schemas.android.com/apk/res/android\">\n    <item android:drawable=\"@drawable/theme_maintab_ico_piccoma_focused_image\" android:state_selected=\"true\" />\n    <item android:drawable=\"@drawable/theme_maintab_ico_piccoma_image\" />\n</selector>\n",
"drawable/theme_tab_shopping_icon.xml": "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<selector xmlns:android=\"http://schemas.android.com/apk/res/android\">\n    <item android:drawable=\"@drawable/theme_maintab_ico_shopping_focused_image\" android:state_selected=\"true\" />\n    <item android:drawable=\"@drawable/theme_maintab_ico_shopping_image\" />\n</selector>\n"
}
for path, text in ADV.items(): write('res/' + path, text)
write('res/mipmap-xxhdpi/ic_launcher.png', png(144, 144, (240, 236, 228, 255)))
with open('template.json', 'w', encoding='utf-8') as f:
    json.dump({'marks': MARKS, 'names': NAMES, 'filler': FILLER}, f, ensure_ascii=False)
print('template project ready:', len(DRAWABLES), 'drawables,', len(NAMES), 'colors')
