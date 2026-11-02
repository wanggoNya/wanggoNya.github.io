---
title: "Wireshark Opensource 활용기 | Protocol Dissector를 직접 추가하기"
categories:
  - "Network"
tags:
  - "Wireshark"
permalink: /network/99/
date: 2024-11-09T22:19:45+09:00
last_modified_at: 2025-04-11T12:17:16+09:00
toc: true
toc_sticky: true
tistory_url: https://wanggonya.tistory.com/99
---

### Wireshark, 강력한 네트워크 분석 오픈소스

![Wireshark](/assets/images/posts/tistory/99/01.png)

*Wireshark*

[Wireshark](https://ko.wikipedia.org/wiki/%EC%99%80%EC%9D%B4%EC%96%B4%EC%83%A4%ED%81%AC "Wireshark Wikipedia")는 대표적인 패킷 분석 툴이다. [Wireshark 오픈 소스](https://gitlab.com/wireshark/wireshark "Wireshark Open Source")를 활용해서, 직접 Protocol Dissector를 추가해보자.
설명할 문서는 Wireshark의 9.2. Adding a basic dissector 부분이다.

### 9.2 기본적인 dissector를 추가하기

문서에서는 Foo 프로토콜을 예시로 들고있다.

- 패킷 타입 - 8 bit size
	- 가능한 값
		- 1 - 초기화 (initialisation)
		- 2 - 종료 (terminate)
		- 3 - 데이터 (data)
- 플래그 집합 - 8비트 크기.
	- 값
		- 0x01 - 시작 패킷 (start packet)
		- 0x02 - 종료 패킷 (end packet)
		- 0x04 - 우선 패킷 (priority packet)
- 시퀀스 번호 - 16비트 크기.
- IPv4 주소

#### 9.2.1. Dissector 설정하기

디섹터를 설정할 때 처음 결정해야 할 사항은 이 디섹터가 메인 프로그램에 포함된 내장형 디섹터인지, 아니면 플러그인으로 작성될지 이다. 플러그인은 처음에 작성하기 더 쉬우므로, 플러그인으로 시작하겠다. 조금만 신경 쓰면 플러그인을 내장형 디섹터로 변환할 수 있다.

Dissector 초기화

```cpp
#include "config.h"
#include <epan/packet.h>

#define FOO_PORT 1234

static int proto_foo;

void proto_register_foo(void) {
    proto_foo = proto_register_protocol (
        "FOO Protocol", /* 이름 */
        "FOO",          /* 짧은 이름 */
        "foo"           /* 필터 이름 */
    );
}
```

각 부분을 하나씩 살펴보자.

먼저, 기본적인 포함 파일(include files)들이 있다. 기본적으로 config.h와 &lt;epan/packet.h&gt;를 포함한다.
그 다음, foo 트래픽을 전송하는 UDP 포트를 지정하는 #define FOO_PORT 구문이 있다.

그 뒤로는 proto_foo 라는 변수가 있다. 이는 프로토콜 핸들을 저장하는 `int` 변수로, 초기값은 -1로 설정된다. 이 핸들은 dissector가 메인 프로그램에 등록될 때 설정된다. (외부로 공개되지 않는 변수와 함수는 static으로 선언하여 네임스페이스 오염을 최소화하는 것이 좋다. 파일이 여러 개로 나뉘어지지 않는 한 문제가 되진 않을 것이다.)

여기까지 메인 프로그램과 상호작용하기 위한 기본 사항이 준비되었다.
그럼 두 개의 프로토콜 dissector 설정 함수인 proto_register_XXX와 proto_reg_handoff_XXX부터 알아보자.

#### proto_register_XXX

모든 프로토콜은 proto_register_XXX 형태의 등록 함수가 있어야 한다. 이 함수는 Wireshark에서 프로토콜을 등록하는 데 사용된다. 등록 루틴을 호출하는 코드는 자동으로 생성되며 Wireshark가 시작될 때 호출된다. 이 예제에서는 함수 이름을 proto_register_foo으로 정의하고 있다.

proto_register_foo 는 proto_register_protocol()을 호출한다. 이 함수는 name과 short name, 그리고 filter_name을 인자로 받는다. name과 short name은 " Preferences" 및 " Enabled protocols" 다이알로그와 필드 이름 목록에서 사용된다. filter_name은 디스플레이 필터 이름으로 사용된다.
proto_register_protocol()은 프로토콜 핸들을 반환하며, 이 핸들을 사용하여 프로토콜을 참조하거나 프로토콜의 dissector 핸들을 얻을 수 있다.

다음으로는 핸드오프 루틴이 필요하다. 그리고 테스트가 가능한 소스코드를 추가해보자.

---

[ Reference ]
9.2. Adding a basic dissector

[🔗 9.2. Adding a basic dissector](https://www.wireshark.org/docs/wsdg_html_chunked/ChDissectAdd.html)
