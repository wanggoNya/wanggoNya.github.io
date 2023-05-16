---
title: '[Kubernetes] 쿠버네티스 소개, 왜 쿠버네티스를 사용해야 하는가'
excerpt: "쿠버네티스 Introduction, 기초 Object에 대하여, 그리고 실습"

categories:
categories:
  - Cloud
tags: 
  - [study, cloud, kubernetes]

permalink: /categories2/post-name-here-2/

toc: true
toc_sticky: true

date: 2023-03-13
last_modified_at: 2023-03-13
---

# 쿠버네티스 : 대세는 쿠버네티스 [초급~중급]

# Introduction

- 서버 자원을 효율적으로 사용함으로써 비용면에서 유리하기 위한 가상화 기술
- 컨테이너 가상화기술 : 서비스간 자원격리를 할 때 OS를 별도로 띄우지 않아도 된다. OS 기동시간이 없기 때문에 자동화시에 엄청 빠르고, 자원 효율도 매우 높다.
    - 도커 : 하나의 서비스를 컨테이너로 가상화시켜서 배포를 하는 거지, 여러 개의 서비스를 운영할 때는 그걸 일일히 배포하고 운영하는 역할은 해주지 않는다. 이런 기능은 컨테이너 오케스트레이터를 이용한다.
    - 컨테이너 오케스트레이터 : 위에서 서술한 것처럼, 여러 컨테이너들을 관리해주는 솔루션
    
![Untitled](https://user-images.githubusercontent.com/96973332/226365731-66e8815e-c8af-49c1-b972-6459f7867f2f.png)
        
- 쿠버네티스까지 오기까지의 히스토리 (2015.7 ~ 주목)
    
![Untitled 1](https://user-images.githubusercontent.com/96973332/226365884-f67c2681-b987-4125-8a48-fb2e6c0de88c.png)
    
    - 구글의 컨테이너 기술이 오픈 소스기 때문에 많은 기업들이 오케스트레이터를 내놓는다. 그런데 구글 쿠버네티스는 여러 업체들이 참여하면서 여러 환경(Red Hat, Microsoft, IBM 등등)에서 사용할 수 있도록 지원하게 된다. 이로써 개발자들이 가장 많이 사용하는 오케스트레이터의 표준이 쿠버네티스가 된 것.
    - 이렇게 쿠버네티스가 서비스 배포/운영에 표준이 되고, 여러 클라우드 서비스를 제공하는 업체들이 이 기술을 바탕으로 쿠버네티스 환경이 설치되어 있는 인프라를 서비스하고 있다. 따라서 쿠버네티스를 이용하고자 한다면, AWS, AZURE 등등 클라우드 서비스 업체를 선택하면 되는 것.
- 쿠버네티스 범주 : User / Admin
    - 쿠버네티스 기능을 이용해 서비스 배포하는 사용자 (User)
    - 쿠버네티스 클러스트 운영자 (Admin)
    
![Untitled 2](https://user-images.githubusercontent.com/96973332/226365972-b435ee6b-4fea-47cd-b0ab-122bbaa0f8e9.png)
    
    ( User 중에서도 색 칠해져 있는 부분만 강좌)
    

# [기초편] 기초 다지기

- 왜 쿠버네티스를 사용해야 하는가, 장점, 어떤 자동화 기능을 제공하는가
    - 여러 서비스를 운영하는 경우 (카카오, 네이버), 게임 서버 (트래픽 예측과 원활 접속)
    - 기존
        - 평소 : 시간대별로 트래픽 양이 다르다고 할 때, 세 개의 시간대에 대비해 각 세 대씩의 서버가 필요하다. = 총 9대의 서버 필요
        - 장애 : 장애가 날 경우를 대비해 각 한 대씩 백업 서버가 필요 = 3대 필요
        - 총 9대 + 3대 = 12대 필요
        - 업데이트 : 서버를 전부 내렸다가 패치 후 올리거나, 무중단 서비스일 때는 한 대씩 패치
        
![Untitled 3](https://user-images.githubusercontent.com/96973332/226366050-e0f15aff-0c19-484c-b814-b789df115715.png)

    - 쿠버네티스 사용 후
        - 평소 (Auto Scaling 기능) : 쿠버네티스 안의 서버에서 Auto Scaling 기능을 통해 트래픽 양에 따라 알아서 서비스의 자원량을 변경함 = 3대 필요
        - 장애 (Auto Healing 기능) : 장애가 난 서비스 위의 서버가 장애 났을 경우 그 서버쪽으로 지원하는 Auto Healing 기능으로 여분 서버 한 대만으로 알아서 대응 = 1대 필요
        - 총 3대 + 1대 = 4대 필요
        - 업데이트 (Deployment 오브젝트 기능) : 업데이트 기능에 대해서 자동으로 업데이트 되도록 지원
        
        ⇒ 기타 여러 상황을 자동화하고 있고, 유지보수성이 높아지고 자원과 비용을 아낄 수 있으므로 서비스 규모가 클수록 쿠버네티스를 사용하는 게 비용면이나 편의성면에서 유리하다.
        
![Untitled 4](https://user-images.githubusercontent.com/96973332/226366135-4e78122a-5411-40a2-a6a4-31826bef3b6d.png)
---

- VM vs Container
    - VM
        - 서비스별로 각각의 OS를 띄워야 한다.
    - Container (도커가 하는 일)
        - 하나의 OS를 공유한다.
        - 서비스 별로 다르게 적용해야 하는 버전 (예를 들어 A 서비스는 JDK 1.6, B 서비스는 1.7)을 도커 이미지를 다르게 해서 A 서비스는 A 이미지, B 서비스는 B 이미지로 분리 할 수 있다. 서비스 별로 관리하기 쉬워진다.
        - 도커 같은 컨테이너 가상화 기술은 OS에서 제공하는 자원 격리 기술을 이용해서 컨테이너 단위로 서비스를 분리할 수 있게 되고, 여러 컨테이너가 호스트 자원을 분리해서 쓸 수 있도록 해준다. 개발 환경 걱정이 사라짐
            
![Untitled 5](https://user-images.githubusercontent.com/96973332/226366185-53ad602e-f88f-4b17-95bf-bc75106c5818.png)
            
            namespace : 커널에 관련된 영역 분리
            
            cgroups : 자원 영역 분리
            
![Untitled 6](https://user-images.githubusercontent.com/96973332/226366260-8309c835-629b-4312-a3bd-6594c06ffd1a.png)
            
    - VM과 비교한 컨테이너의 단점
        - 컨테이너 (리눅스형 OS) 에서 윈도우를 띄우지 못함
        - 보안적으로, VM은 게스트OS가 뚫려도 각각의 VM끼리 피해가 가지 않지만 컨테이너는 하나의 컨테이너만 뚫려도 다른 컨테이너들까지 위험해질 수 있음 (보완 중이긴 함)
    - 배포 측면에서 VM vs Container
        - VM : 한 게스트OS에 한 서비스에는 모듈 A, B, C가 들어있다. 만약 모듈 C에 부하가 많아 서버를 더 확장해야 한다면 모듈 C만을 위한 게스트OS를 더 띄우는 게 아니라 모듈 A, B, C가 포함된 서비스 전체를 띄워야 하므로 낭비가 생긴다.
        - 컨테이너 : 모듈 A, B, C 별로 컨테이너를 구별할 수 있고 쿠버네티스는 여기서 Pod라는 배포 단위를 지원한다. Pod로 묶어서 배포 단위로 구별 할 수 있다. 컨테이너는 시스템을 모듈 별로 쪼개서 개발 했을 때 큰 효과를 발휘한다!
        
![Untitled 7](https://user-images.githubusercontent.com/96973332/226366310-ef65f120-e58c-42a9-bf4e-0b4f2b471775.png)
        
- 웹 구동 + 쿠버네티스가 어떻게 돌아가는지
    - 실습 내용 : Linux 위에 nodeJs를 올린다. 이 서버를 도커 컨테이너에 올린다. Docker Hub도 이용한다. 쿠버네티스를 이용하고, Pod 안에 컨테이너를 올릴 때 마찬가지로 Docker Hub를 이용한다.
    - 주의할 점 : 웹에서 오픈하는 port와 targetport 구별하자.
    
![Untitled 8](https://user-images.githubusercontent.com/96973332/226366486-794c7d90-0460-4520-bb78-42d64980e983.png)
    
    - 실습 과정 기록
        
        ```bash
        # yum install nodejs
        # node -v
        v16.8.0
        
        # vi hello.js
        (안에 들어가는 내용은 https://kubetm.github.io/k8s/02-beginner/gettingstarted/ 참고)
        
        # vi Dockerfile
        FROM node:slim
        EXPOSE 8000
        COPY hello.js .
        CMD node hello.js
        
        # docker build -t sooyeonkim/hello .
        
        # docker images
        # docker run -d -p 8100:8000 sooyeonkim/hello
        ```
        
- 쿠버네티스 오브젝트에 대한 디테일 (Overview)

# [기초편] 쿠버네티스 설치

# [기초편] 기본 오브젝트

# [기초편] 컨트롤러

# [중급편] Pod

# [중급편] 기본 오브젝트

# [중급편] 컨트롤러

# [중급편] 아키텍쳐

# [Deprecated] 질의응답 미지원 강의
---
        
[ Reference ]
인프런 - 대세는 쿠버네티스 [초급~중급] 강의
