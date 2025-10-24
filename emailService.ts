import emailjs from '@emailjs/browser';

// EmailJS 설정
// ⚠️ 진짜 메일 발송을 위해 아래 3개 값을 EmailJS에서 발급받은 실제 값으로 교체하세요!

const EMAILJS_SERVICE_ID = 'service_l95seeq'; // ← EmailJS Service ID
const EMAILJS_TEMPLATE_ID = 'template_qvwwqmn'; // ← EmailJS Template ID  
const EMAILJS_PUBLIC_KEY = 'NrBZqLXAkGExMDcJu'; // ← EmailJS Public Key

/* 
🔧 설정 완료 예시:
const EMAILJS_SERVICE_ID = 'service_abc123';
const EMAILJS_TEMPLATE_ID = 'template_xyz789'; 
const EMAILJS_PUBLIC_KEY = 'abc123xyz';

📧 EmailJS 템플릿 변수:
- {{to_email}} : 수신자 이메일
- {{subject}} : 메일 제목  
- {{title}} : 공지 제목
- {{content}} : 공지 내용
- {{author_name}} : 작성자
- {{priority}} : 우선순위
- {{created_at}} : 작성일시
- {{from_name}} : 발신자명
*/

// EmailJS 초기화
emailjs.init(EMAILJS_PUBLIC_KEY);

export interface EmailData {
  to_emails: string[];
  subject: string;
  title: string;
  content: string;
  author_name: string;
  priority: string;
  created_at: string;
}

export const sendUrgentNoticeEmail = async (emailData: EmailData): Promise<boolean> => {
  try {
    console.log('📧 메일 전송 시작:', {
      service: EMAILJS_SERVICE_ID,
      template: EMAILJS_TEMPLATE_ID,
      publicKey: EMAILJS_PUBLIC_KEY,
      recipients: emailData.to_emails
    });

    // 각 수신자에게 개별적으로 메일 전송
    const promises = emailData.to_emails.map(async (email) => {
      const templateParams = {
        // 템플릿에서 정의된 변수명에 맞춰 매핑
        name: email.split('@')[0], // {{name}} 변수
        time: emailData.created_at, // {{time}} 변수  
        subject: emailData.subject, // {{subject}} 변수
        title: emailData.title, // {{title}} 변수
        priority: emailData.priority, // {{priority}} 변수
        created_at: emailData.created_at, // {{created_at}} 변수
        content: emailData.content, // {{content}} 변수
        author_name: emailData.author_name, // {{author_name}} 변수
        message: `
제목: ${emailData.title}
우선순위: ${emailData.priority}
작성일: ${emailData.created_at}

내용:
${emailData.content}

---
웹툰 프로덕션 트래커에서 발송된 급한일 공지입니다.
        `.trim()
      };

      console.log(`📨 ${email}로 메일 전송 중...`, templateParams);

      // EmailJS 직접 전송 (템플릿 우회)
      const result = await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        {
          ...templateParams,
          to_email: email, // 수신자
          reply_to: 'mjymjwzlzl@gmail.com' // 답장 주소
        },
        EMAILJS_PUBLIC_KEY
      );

      console.log(`✅ ${email} 메일 전송 성공:`, result);
      return result;
    });

    const results = await Promise.all(promises);
    console.log('🎉 모든 메일 전송 완료:', results);
    return true;
  } catch (error) {
    console.error('❌ 메일 전송 실패:', error);
    console.error('에러 세부사항:', {
      message: error.message,
      stack: error.stack
    });
    return false;
  }
};

// EmailJS 설정 상태 확인
export const isEmailServiceConfigured = (): boolean => {
  return EMAILJS_PUBLIC_KEY === 'NrBZqLXAkGExMDcJu' && 
         EMAILJS_SERVICE_ID === 'service_l95seeq' && 
         EMAILJS_TEMPLATE_ID === 'template_qvwwqmn';
};
