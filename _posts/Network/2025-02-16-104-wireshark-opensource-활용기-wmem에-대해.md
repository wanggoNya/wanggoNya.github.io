---
title: "Wireshark Opensource 활용기 | wmem에 대해"
categories:
  - "Network"
tags:
  - "Wireshark"
permalink: /network/104/
date: 2025-02-16T23:54:57+09:00
last_modified_at: 2026-04-02T17:04:48+09:00
toc: true
toc_sticky: true
tistory_url: https://wanggonya.tistory.com/104
---

## wmem,Wireshark Memory Management Framework에 대해

![Wireshark](/assets/images/posts/tistory/104/01.png)

*Wireshark*

[Wireshark](https://ko.wikipedia.org/wiki/%EC%99%80%EC%9D%B4%EC%96%B4%EC%83%A4%ED%81%AC)는 대표적인 패킷 분석 툴이다. [Wireshark 오픈 소스](https://gitlab.com/wireshark/wireshark)에서 자주 보이는 wmem과 wmem_alloc()에 대해 알아보자.

#### • 핵심 소스코드 위치

- epan/wmem/wmem_core.c
- epan/wmem/wmem_scopes.c

#### • wmem 관련 Document

- [README.wmem](https://github.com/wireshark/wireshark/blob/master/doc/README.wmem "wmem document")

## 0. 글을 쓰게 된 배경?

최근 wireshark 소스 코드 내 패킷 처리 로직을 수정하다가,  패킷의 페이로드를 버퍼로 가져와 사용할 일이 있어 wmem_alloc()을 호출했다. 당연히 alloc과 free는 함께 이루어져야 하지만 wmem_alloc()은 별도로 free 해주지 않아도 Memory Leak이 발생하지 않아, 그 이유를 명확히 하기 위해 리서치를 진행했다. 정확하게 알아보니 wmem_alloc()은 free()를 하지 않아도 되는 게 아니라, **하면 안 되는** 함수였다.

## 1. wmem_alloc() 사용 후 free()를 호출하면 안 되는 이유

Wireshark는 일반적인 malloc/free 방식이 아니라, 자체적인 **wmem (Wireshark Memory Management)** 시스템을 사용한다.
특히 다음과 같은 것들을 인지하고 사용해야 한다.

- wmem_alloc()을 사용하여 할당된 메모리는 **스코프(scope)에** 따라 자동으로 해제된다.
	- wmem_packet_scope() → **패킷 처리가 끝나면 자동 해제**
	- wmem_file_scope() → **파일 전체 처리가 끝나면 자동 해제**
	- wmem_epan_scope() → **Wireshark 세션이 종료되면 자동 해제**

따라서, free()를 호출하면 문제가 발생한다. wmem_alloc()은 malloc()으로 할당된 메모리가 아니므로 free()를 호출하면 **메모리 손상, 충돌(Crash), 예측할 수 없는 동작(Undefined Behavior)** 이 발생할 수 있다.

## 2. wmem_alloc() 메모리는 어떻게 관리해야 할까?

다음은 함수 원형과 사용 예시다. **다음과 같이 사용할 경우 메모리를 따로 관리해주지 않아도 된다!**

```
void *wmem_alloc(wmem_allocator_t *allocator, size_t size) {
    return allocator->mem_chunk_alloc(allocator, size);
}
```

```
void wmem_allocator_free_all(wmem_allocator_t *allocator) {
    allocator->free_all(allocator);
}
```

```cpp
guint8 *tvb_payload = (guint8 *) wmem_alloc(wmem_packet_scope(), length);
```

여기서 중요한 것은 **tvb_payload**는 패킷 처리 후 자동으로 해제되기 때문에 free(tvb_payload);를 호출하면 안 된다는 점이다! 또 Memory Leak에 대해 걱정할 필요가 없다. wmem_alloc은 따로 free()를 호출하지 않아도 Wireshark가 자동으로 정리해 주기 때문이다. **만약 free()를 호출하게 될 경우,  패킷 처리가 완료되지 않았는데 메모리 해제가 되어 뒷단의 로직에서 어떤 일이 발생할지 예상할 수 없으며, double free가 발생할 수 있다.**

**그렇기에 wmem_alloc을 사용한 경우 free()나****g_free()를 절대 사용하면 안 된다.**

그럼 어떤 경우에도 Memory Leak은 발생하지 않을까?
Memory Leak이 발생하는 상황은 어떤 상황일까?

## 3. Memory Leak이 발생하는 경우

Wireshark에서 wmem_alloc()을 사용하면 일반적으로 Memory Leak이 발생하지 않지만, 다음과 같이 잘못된 사용으로 인해서 Memory Leak이 발생할 수도 있다.

#### •  wmem_packet_scope()에서 할당된 메모리를 전역 변수에 저장하는 경우

```cpp
static guint8 *global_payload; // 정적(static) 변수에 저장

void process_packet(tvbuff_t *tvb) {
    global_payload = (guint8 *) wmem_alloc(wmem_packet_scope(), length);
    // 이전 global_payload의 포인터가 유실되면서 Memory Leak 발생
}
```

wmem_packet_scope()에서 할당된 메모리를 **전역 변수**에 저장하면, **해당 패킷이 끝날 때 메모리가 해제되므로 유효하지 않은 포인터를 가리키게 된다.**

#### •  해결 방법

전역 변수로 저장해야 하는 경우, **파일 단위 또는 세션 단위의 메모리 scope를 사용해야 한다.**
wmem_file_scope() 또는 wmem_epan_scope()을 사용하면 Wireshark 세션이 끝날 때까지 데이터를 유지할 수 있다.

## 4. 정리하자면,

- wmem_alloc()로 할당된 메모리를 free()로 해제하면 안 된다.
- Wireshark의 메모리 시스템이 자동으로 메모리를 해제하기 때문.
- 하지만 전역 변수에 저장할 경우 scope 사용에 조심해야 하고, 이 경우 메모리 해제를 신경 써주어야 한다.
- Wireshark의 메모리 관리 방식은 성능을 최적화하고 메모리 관리를 자동화하도록 설계되어 있으므로, 수동으로 free()를 하지 않는 것이 권장하는 것이 기본 컨셉이다.
- wmem과 free 관계를 명확히 이해하기 위해서는 scope에 대해 자세하게 공부하면 좋다.

---

[ Reference ]
[Wireshark Memory Management (wmem)](https://www.wireshark.org/docs/wsdg_html_chunked/wmem.html)
[Wireshark GitLab Repository (wmem_allocator.c)](https://gitlab.com/wireshark/wireshark/-/blob/master/epan/wmem/wmem_allocator.c)
