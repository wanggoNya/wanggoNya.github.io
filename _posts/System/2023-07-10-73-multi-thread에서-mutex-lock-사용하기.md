---
title: "Multi Thread에서 mutex lock 사용하기"
categories:
  - "System"
tags:
  - "Parallel Computing"
permalink: /system/73/
date: 2023-07-10T23:40:57+09:00
last_modified_at: 2025-05-28T19:13:26+09:00
toc: true
toc_sticky: true
tistory_url: https://wanggonya.tistory.com/73
---

> ※  아래 내용은 스스로 공부한 내용을 정리한 글입니다.
> ※  때로 정확하지 않을 수 있으며, 참고만 부탁드립니다.
> ※  잘못된 내용이 있을시 댓글로 알려주시면 감사하겠습니다.

#### 멀티 스레드 환경에서 공유 자원에 동시에 접근해도 될까?

멀티 스레드 환경에서 공유된 자원에 동시에 접근하게 되면, 스레드끼리 경쟁이 일어나면서 false sharing(거짓 공유), cache thrashing(캐시 쓰레싱), cache invalid storm 같은 문제가 발생한다. 이를 해결하기 위해 공유 자원에 접근할 때 하나의 스레드가 접근하고 있는 경우 다른 스레드는 접근하지 못하도록 제한하기 위해 mutex lock을 이용한다.

#### Mutex는 무엇일까?

Mutext는 mutual exclusion이라는 뜻으로, 직역하면 상호 배제라는 의미이다. 스레드들은 자원에 접근하기 위해 락(lock)을 획득하고 접근 허용 권한을 얻어야 한다. 이미 다른 스레드가 락(lock)을 통해 접근 권한을 허용 받으면, 다른 스레드는 자원 사용이 불가하다. 락(lock)을 받은 스레드가 Unlock을 통해 권한을 반환한 이후에만 다른 스레드도 공유 자원을 이용할 수 있다.

### Mutex 함수

아래 함수들은 모두 성공 시 0을 반환한다.

**1. Mutex Initialize**

```cpp
int pthread_mutex_init(pthread_mutex_t *mutex, const pthread_mutexattr_t *mutexattr);
```

mutex는 사용하기 전 초기화되어야 한다.

**2. Mutex Lock**

```cpp
int pthread_mutex_lock(pthread_mutex_t *mutex);
```

mutex를 lock하는 함수로, 다른 스레드가 공유 자원에 접근할 수 없도록 한다. 한 스레드가 lock을 건 상태에서 공유 자원에 접근하고 있을 때, 다른 스레드가 해당 공유 자원에 접근하게 되면, 이전에 진입한 스레드가 Unlock하기 전까지 대기 상태에 있어야 한다.

**3. Mutex Unlock**

```cpp
int pthread_mutex_unlock(pthread_mutex_t *mutex);
```

mutex의 lock을 풀 때 사용한다. 공유 자원에 대한 처리가 끝나면 Unlock을 통해 다른 스레드도 공유 자원에 접근할 수 있도록 해야 한다. 만약 Unlock 해주지 않는다면, 교착 상태(Deadlock)이 일어난다.

**4. Mutex Destroy**

```cpp
int pthread_mutex_unlock(pthread_mutex_t *mutex);
```

mutex와 관련된 자원의 lock을 해제할 때 사용하는 함수이다.

### 코드 전문

아래 코드는 mutex initialize와 destroy를 사용하지 않은 상태에서 perf를 통해 성능을 측정하기 위한 코드다. 참고 바람.

```cpp
#include <stdio.h>
#include <pthread.h>
#include <stdlib.h>
#include <string.h>

pthread_mutex_t lock;
int global = 0;
int global_lock = 0;
__thread int tls = 0;

int handler(void *data)
{
    char* thread_name = (char *)data;
    int i = 0;
    int stack = 0;
    pid_t pid;
    pthread_t tid;
    pid = getpid();
    tid = pthread_self();
    printf("thread name : %s, tid : %x, pid : %u\n", thread_name, (unsigned int)tid, (unsigned int)pid);

    int count = 10000;

    while(count > 0) {
        stack++;
        global++;
        tls++;

        pthread_mutex_lock(&lock);
        global_lock++;
        pthread_mutex_unlock(&lock);

        count--;
    }

    printf("thread name : %s, stack : %d, global : %d, tls : %d, global_lock : %d\n", thread_name, stack, global, tls, global_l
    printf("\n\n\n");

    return 0;
}

int main(void)
{
    int i;
    int thread_num = 8;
    pthread_t pthread[thread_num];
    char tmp_name[32] = "prep_name0";
    void *status;

    for (i = 0; i < thread_num; i++) {
        sprintf(tmp_name, "prep_name%d", i);
        if (pthread_create(&pthread[i], NULL, handler, (void*)tmp_name) < 0) {
            printf("pthread create failed ( thread : %d )\n", i);
            exit(1);
        }
        //sleep(1);
        memset(tmp_name, 0, sizeof(tmp_name));
    }
    int sec = 5;
    while (sec > 0) {
        sec--;
        sleep(1);
    }
    printf("global : %d, tls : %d, global_lock : %d\n", global, tls, global_lock);
    /*
    for (i = 0; i < thread_num; i++) {
        pthread_join(pthread[i], &status);
    }
    */
    printf("END\n");
    return 0;
}
```

### 멀티 스레드 환경에서 다양한 변수값 비교하기

**1. Local 변수 (stack)**

**2. Global 변수 (global)**

**3. Global + TLS 변수 (tls)**

**4. Global + mutex lock 이용한 변수 (global_lock)**

handler 함수에 나온 것처럼, 각 스레드마다 루프를 10,000번씩 돌리며 위 네 가지 변수에 +1을 더하면서 결과를 관찰했다.

스레드는 8개를 생성했다.

예상대로라면 local 변수와 tls 변수에는 하나의 스레드만 접근하므로 루프 횟수인 10,000이라는 값이 들어가야 하며,

global 변수와 global_lock 변수는 모든 스레드가 10,000번씩 접근하므로 8개의 스레드를 곱한 80,000이라는 값이 들어가야 한다.

**출력값**

```bash
stack : 10000, global : 72689, tls : 10000, global_lock : 80000
```

하나의 스레드만 사용하는 **stack**과 **tls**의 값은 10,000으로 **모든 스레드에서의 값이 동일했다.**

**global_lock**의 경우, mutex lock을 통해 8개의 스레드 간 공유 자원 경쟁이 일어나지 않도록 했기 때문에 80,000 ( 루프횟수 * 스레드 수 ) 라는 정확한 값이 나온 것을 볼 수 있다.

**하지만 global 변수의 경우, 공유 자원 간 경쟁이 발생하여 하나의 스레드가 접근하고 있을 때 다른 스레드가 동시에 접근하는 바람에 의도했던 80,000 이라는 숫자가 아닌, 원치 않는 값으로 뒤엉킨 것을 볼 수 있다.**

이로써 멀티 스레드 환경에서 mutex lock을 사용해야 하는 이유를 간단한 예시와 함께 알아보았다. 다음에는 공유 자원간 경쟁이 성능 저하에 어떤 영향을 주는지 알아보고자 한다.

---

#### 함께 보면 좋은 글

- [운영체제] Mutex (Mutual exclusion)
<https://velog.io/@jhlee508/%EC%9A%B4%EC%98%81%EC%B2%B4%EC%A0%9C-Mutex-Mutual-exclusion>
