---
title: "[REST] [Ajax] RESTFul api 방식과 Ajax, json"
categories:
  - "Web"
tags:
  - "Spring boot"
permalink: /web/40/
date: 2022-06-04T23:54:45+09:00
last_modified_at: 2022-06-04T23:54:45+09:00
toc: false
tistory_url: https://wanggonya.tistory.com/40
---

REST (Representational State Transfer)

직역하면 데이터 전송 대표 상태?!

1. 서버가 달라도 데이터를 전송하고 받을 수 있어야한다.

2. 개발할 때 다양한 언어를 쓴다. 다른 언어에서 다른 언어로 객체를 보낼 수 없기때문에 json 등의 방식을 쓴다.

즉, 서버가 달라지고 언어도 달리지니 원활한 데이터 전송을 위해 json을 사용하자는 것. 메서드 불러다가 편하게 데이터 쓰고싶다는 것. 그리고 이런 것을 'REST'라고 한다는 것!

그 전에, URL과 URI의 차이를 보자

UR은 Uniform Resource 를 의미하고

URL 의 L은 Locator

URI의 I는 Identifier를 의미한다.
