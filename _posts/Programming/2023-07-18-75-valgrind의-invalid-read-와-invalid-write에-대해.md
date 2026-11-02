---
title: "Valgrind의 Invalid read 와 Invalid write에 대해"
categories:
  - "Programming"
tags:
  - "C language"
permalink: /programming/75/
date: 2023-07-18T10:48:15+09:00
last_modified_at: 2024-07-26T09:40:40+09:00
toc: false
tistory_url: https://wanggonya.tistory.com/75
---

> ※  아래 내용은 스스로 공부한 내용을 정리한 글입니다.
> ※  때로 정확하지 않을 수 있으며, 참고만 부탁드립니다.
> ※  잘못된 내용이 있을시 댓글로 알려주시면 감사하겠습니다.

## Invalid read

Invalid read는 할당되지 않은 메모리로부터 값을 읽으려 할 때 발생되는 현상이다. malloc()해준 크기를 넘어 값을 읽거나, stack의 상단을 넘치게 읽었을 경우 Invalid read가 발생한다. valgrind에서 Invalid read 메시지가 나올 때는, 얼만큼의 바이트 크기를 초과로 읽어 들였는지 확인할 수 있다.

아래는 Invalid read의 샘플 코드이다.
포인터 변수 p에 20 byte 크기를 할당했고, for 문으로 값을 채워주었다.

하지만 변수 p를 printf 하면서 20 byte를 넘어 24 byte를 읽어 들이고 있다. 이때, 할당해 준 20 byte를 초과하는 24 byte 만큼을 읽게 되어 Invalid read가 발생한다.

```cpp
int main(void) {
    int *p = malloc(5 * sizeof(int));

    if (p == NULL)
        exit(1);

    for (int i = 0; i < 5; i++)
        p[i] = i;

    for (int i = 0; i < 6; i++)
        printf("%d\n", p[i]);

    free(p);
}
```

Valigrind 메시지를 보면, **Invalid read of size 4라고** 나온 것을 확인할 수 있다.

```cpp
==141990== Memcheck, a memory error detector
==141990== Copyright (C) 2002-2017, and GNU GPLd, by Julian Seward et al.
==141990== Using Valgrind-3.17.0 and LibVEX; rerun with -h for copyright info
==141990== Command: ./a.out
==141990== 
0
1
2
3
4
==141990== Invalid read of size 4
==141990==    at 0x4006D6: main (in /test/a.out)
==141990==  Address 0x520b054 is 0 bytes after a block of size 20 alloc'd
==141990==    at 0x4C360A5: malloc (vg_replace_malloc.c:380)
==141990==    by 0x400677: main (in /test/a.out)
==141990== 
0
==141990== 
==141990== HEAP SUMMARY:
==141990==     in use at exit: 0 bytes in 0 blocks
==141990==   total heap usage: 2 allocs, 2 frees, 1,044 bytes allocated
==141990== 
==141990== All heap blocks were freed -- no leaks are possible
==141990== 
==141990== For lists of detected and suppressed errors, rerun with: -s
==141990== ERROR SUMMARY: 1 errors from 1 contexts (suppressed: 0 from 0)
```

## Invalid write

반대로 Invalid write 메시지는 할당해 준 크기보다 값을 더 많이 쓰려고 할 때 발생하는 메시지다.

아래 샘플 코드에서 확인할 수 있듯이, 변수 p에 20 byte 만큼을 할당하고, for 문으로 값을 써줄 때 24 byte 만큼 쓰게 되어 메모리 할당값을 초과하는 것을 볼 수 있다. 이 때도 마찬가지로 Valgrind는 에러 메시지에 몇 바이트만큼 초과했는지 알려준다.

```cpp
int main(void) {
    int *p = malloc(5 * sizeof(int));

    if (p == NULL)
        exit(1);

    for (int i = 0; i < 6; i++)
        p[i] = i;

    for (int i = 0; i < 5; i++) {
        printf("%d\n", p[i]);
    }

    free(p);
}
```

Valigrind 메시지를 보면, **Invalid write of size 4라고** 나온 것을 확인할 수 있다.

```cpp
==144021== Memcheck, a memory error detector
==144021== Copyright (C) 2002-2017, and GNU GPLd, by Julian Seward et al.
==144021== Using Valgrind-3.17.0 and LibVEX; rerun with -h for copyright info
==144021== Command: ./a.out
==144021== 
==144021== Invalid write of size 4
==144021==    at 0x4006AD: main (in /test/a.out)
==144021==  Address 0x520b054 is 0 bytes after a block of size 20 alloc'd
==144021==    at 0x4C360A5: malloc (vg_replace_malloc.c:380)
==144021==    by 0x400677: main (in /test/a.out)
==144021== 
0
1
2
3
4
==144021== 
==144021== HEAP SUMMARY:
==144021==     in use at exit: 0 bytes in 0 blocks
==144021==   total heap usage: 2 allocs, 2 frees, 1,044 bytes allocated
==144021== 
==144021== All heap blocks were freed -- no leaks are possible
==144021== 
==144021== For lists of detected and suppressed errors, rerun with: -s
==144021== ERROR SUMMARY: 1 errors from 1 contexts (suppressed: 0 from 0)
```

---

함께 보면 좋은 글

<https://cs3157.github.io/www/2022-9/guides/valgrind.html>
