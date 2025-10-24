import React, { useState, useRef } from 'react';
import { Project, MonthlyProjectSettlement, MonthlySettlementData } from '../types';

interface AIAssistantProps {
  projects: Project[];
  currentYearMonth: string;
  onUpdateSettlement: (projectId: string, platformEarnings: { [platform: string]: number }) => void;
  onGoBack: () => void;
}

interface ChatMessage {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
  data?: any; // AI 분석 결과 데이터
}

// Google AI API 설정
const GOOGLE_AI_API_KEY = 'AIzaSyDy5T00jth19EWaoD4go-xpAC50YbCypdM';
const GOOGLE_AI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

const AIAssistant: React.FC<AIAssistantProps> = ({ 
  projects, 
  currentYearMonth, 
  onUpdateSettlement, 
  onGoBack 
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      type: 'ai',
      content: '안녕하세요! AI 비서입니다. 엑셀 파일이나 매출 스크린샷을 업로드해주시면 자동으로 분석해서 매출 데이터를 입력해드릴게요!',
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 메시지 스크롤을 맨 아래로
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // 파일을 Base64로 변환
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // data:image/jpeg;base64, 부분을 제거하고 순수 base64만 반환
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = error => reject(error);
    });
  };

  // Google AI API 호출
  const callGoogleAI = async (prompt: string, imageBase64?: string) => {
    const requestBody: any = {
      contents: [{
        parts: [{
          text: prompt
        }]
      }]
    };

    // 이미지가 있는 경우 추가
    if (imageBase64) {
      requestBody.contents[0].parts.push({
        inline_data: {
          mime_type: "image/jpeg",
          data: imageBase64
        }
      });
    }

    const response = await fetch(`${GOOGLE_AI_API_URL}?key=${GOOGLE_AI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`API 호출 실패: ${response.status}`);
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  };

  // 파일 업로드 처리
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    
    // 사용자 메시지 추가
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: `파일 업로드: ${file.name}`,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);

    try {
      let analysisResult;
      
      if (file.type.startsWith('image/')) {
        // 이미지 파일인 경우
        const imageBase64 = await fileToBase64(file);
        const prompt = `이 이미지를 분석해서 웹툰/웹소설 매출 데이터를 추출해주세요. 
        
다음 형식으로 JSON을 반환해주세요:
{
  "summary": "분석 결과 요약",
  "extractedData": [
    {
      "projectTitle": "작품명",
      "platformEarnings": {
        "플랫폼명": 금액(숫자만)
      }
    }
  ]
}

현재 작품 목록: ${projects.map(p => p.title).join(', ')}

주의사항:
- 금액은 숫자만 입력 (예: 1000000)
- 플랫폼명은 정확히 매칭해주세요
- 작품명이 현재 목록에 없으면 새로 추가하세요`;

        const aiResponse = await callGoogleAI(prompt, imageBase64);
        analysisResult = JSON.parse(aiResponse);
        
      } else if (file.type.includes('sheet') || file.type.includes('csv')) {
        // 엑셀/CSV 파일인 경우
        const fileContent = await file.text();
        const prompt = `이 엑셀/CSV 데이터를 분석해서 웹툰/웹소설 매출 데이터를 추출해주세요.
        
데이터:
${fileContent}

다음 형식으로 JSON을 반환해주세요:
{
  "summary": "분석 결과 요약",
  "extractedData": [
    {
      "projectTitle": "작품명",
      "platformEarnings": {
        "플랫폼명": 금액(숫자만)
      }
    }
  ]
}

현재 작품 목록: ${projects.map(p => p.title).join(', ')}

주의사항:
- 금액은 숫자만 입력 (예: 1000000)
- 플랫폼명은 정확히 매칭해주세요
- 작품명이 현재 목록에 없으면 새로 추가하세요`;

        const aiResponse = await callGoogleAI(prompt);
        analysisResult = JSON.parse(aiResponse);
      } else {
        throw new Error('지원하지 않는 파일 형식입니다.');
      }
      
      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: `파일을 분석했습니다! 다음과 같은 매출 데이터를 발견했어요:\n\n${analysisResult.summary}`,
        timestamp: new Date(),
        data: analysisResult
      };
      
      setMessages(prev => [...prev, aiMessage]);
      
    } catch (error) {
      console.error('AI 분석 오류:', error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: `죄송합니다. 파일 분석 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // AI 분석 결과 적용
  const applyAnalysisResult = (data: any) => {
    if (!data.extractedData) return;

    data.extractedData.forEach((item: any) => {
      const project = projects.find(p => p.title === item.projectTitle);
      if (project) {
        onUpdateSettlement(project.id, item.platformEarnings);
      }
    });

    const confirmMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'ai',
      content: '✅ 매출 데이터가 성공적으로 적용되었습니다! 정산 페이지에서 확인해보세요.',
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, confirmMessage]);
  };

  // 메시지 전송
  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: inputMessage,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    const currentInput = inputMessage;
    setInputMessage('');
    setIsAnalyzing(true);

    try {
      const prompt = `사용자가 "${currentInput}"라고 말했습니다. 
      
웹툰/웹소설 매출 데이터 분석에 도움을 주는 AI 비서로서 응답해주세요.
파일 업로드를 통해 매출 데이터를 분석할 수 있다고 안내해주세요.

현재 작품 목록: ${projects.map(p => p.title).join(', ')}`;

      const aiResponse = await callGoogleAI(prompt);
      
      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: aiResponse,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, aiMessage]);
      
    } catch (error) {
      console.error('AI 응답 오류:', error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: '죄송합니다. 응답 중 오류가 발생했습니다. 파일을 업로드해주시면 분석해드릴게요!',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 드래그 앤 드롭 핸들러
  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
    
    const files = event.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileUpload({ target: { files } } as any);
    }
  };

  // 엔터키로 메시지 전송
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="h-full bg-slate-50 flex flex-col">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onGoBack}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="뒤로가기"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-xl font-bold text-gray-900">AI 비서</h1>
          </div>
          <div className="text-sm text-gray-500">
            {currentYearMonth ? `${currentYearMonth.split('-')[0]}년 ${parseInt(currentYearMonth.split('-')[1])}월` : '월 선택 필요'}
          </div>
        </div>
      </div>

      {/* 채팅 영역 */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* 메시지 리스트 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-3 ${
                  message.type === 'user'
                    ? 'bg-primary-blue text-white'
                    : 'bg-white border border-gray-200'
                }`}
              >
                <div className="whitespace-pre-wrap text-sm">
                  {message.content}
                </div>
                {message.data && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <button
                      onClick={() => applyAnalysisResult(message.data)}
                      className="w-full px-4 py-2 bg-primary-blue text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                    >
                      📊 분석 결과 적용하기
                    </button>
                  </div>
                )}
                <div className={`text-xs mt-2 ${
                  message.type === 'user' ? 'text-blue-100' : 'text-gray-500'
                }`}>
                  {message.timestamp.toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))}
          {isUploading && (
            <div className="flex justify-start">
              <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-blue"></div>
                  AI가 파일을 분석하고 있습니다...
                </div>
              </div>
            </div>
          )}
          {isAnalyzing && (
            <div className="flex justify-start">
              <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-blue"></div>
                  AI가 응답을 생성하고 있습니다...
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* 파일 업로드 영역 */}
        <div className="border-t border-gray-200 bg-white p-4">
          <div className="flex items-center gap-4">
            {/* 파일 업로드 버튼 */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-sm font-medium text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              📁 파일 업로드
            </button>
            
            {/* 숨겨진 파일 입력 */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv,.png,.jpg,.jpeg"
              onChange={handleFileUpload}
              className="hidden"
            />

            {/* 메시지 입력 */}
            <div className="flex-1 flex items-center gap-2">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="메시지를 입력하세요..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-blue focus:border-primary-blue text-sm"
                disabled={isUploading || isAnalyzing}
              />
              <button
                onClick={handleSendMessage}
                disabled={!inputMessage.trim() || isUploading || isAnalyzing}
                className="px-4 py-2 bg-primary-blue text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                전송
              </button>
            </div>
          </div>
          
           {/* 드래그 앤 드롭 영역 */}
           <div 
             className={`mt-3 p-4 border-2 border-dashed rounded-lg text-center text-sm transition-colors ${
               isDragOver 
                 ? 'border-primary-blue bg-blue-50 text-primary-blue' 
                 : 'border-gray-300 text-gray-500 hover:border-gray-400'
             }`}
             onDragOver={handleDragOver}
             onDragLeave={handleDragLeave}
             onDrop={handleDrop}
           >
             또는 파일을 여기에 드래그&드롭하세요
             <br />
             <span className="text-xs">지원 형식: Excel (.xlsx, .xls), CSV, 이미지 (.png, .jpg, .jpeg)</span>
           </div>
        </div>
      </div>
    </div>
  );
};

export default AIAssistant;
