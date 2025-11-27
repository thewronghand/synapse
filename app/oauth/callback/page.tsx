'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

function OAuthCallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('OAuth 처리 중...');

  useEffect(() => {
    const processCallback = async () => {
      const data = searchParams.get('data');
      const error = searchParams.get('error');
      const provider = searchParams.get('provider');

      if (error) {
        setStatus('error');
        const errorMessages: Record<string, string> = {
          missing_params: '필수 파라미터가 누락되었습니다.',
          invalid_state: '잘못된 상태값입니다.',
          csrf_mismatch: 'CSRF 토큰이 일치하지 않습니다.',
          config_error: 'OAuth 설정 오류입니다.',
          token_exchange_failed: '토큰 교환에 실패했습니다.',
          no_access_token: '액세스 토큰을 받지 못했습니다.',
          oauth_failed: 'OAuth 인증에 실패했습니다.',
          missing_code: '인증 코드가 누락되었습니다.',
        };
        setMessage(errorMessages[error] || `오류: ${error}`);

        // Redirect to settings with error after delay
        setTimeout(() => {
          router.replace(`/settings?error=${error}`);
        }, 2000);
        return;
      }

      if (!data || !provider) {
        setStatus('error');
        setMessage('토큰 데이터 또는 provider가 누락되었습니다.');
        setTimeout(() => {
          router.replace('/settings?error=missing_data');
        }, 2000);
        return;
      }

      try {
        // Parse token data
        const tokenData = JSON.parse(decodeURIComponent(data));

        // Save token via API
        const response = await fetch(`/api/auth/${provider}/save`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(tokenData),
        });

        const result = await response.json();

        if (result.success) {
          setStatus('success');
          setMessage(`${provider === 'github' ? 'GitHub' : 'Vercel'} 연동 완료!`);
          setTimeout(() => {
            router.replace(`/settings?success=${provider}_connected`);
          }, 1000);
        } else {
          throw new Error(result.error || 'Failed to save token');
        }
      } catch (err) {
        console.error('Error processing OAuth callback:', err);
        setStatus('error');
        setMessage('토큰 저장에 실패했습니다.');
        setTimeout(() => {
          router.replace('/settings?error=save_failed');
        }, 2000);
      }
    };

    processCallback();
  }, [searchParams, router]);

  return (
    <div className="text-center p-8">
      {status === 'processing' && (
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
      )}
      {status === 'success' && (
        <div className="text-4xl mb-4">✓</div>
      )}
      {status === 'error' && (
        <div className="text-4xl mb-4">✕</div>
      )}
      <p className="text-lg">{message}</p>
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Suspense fallback={
        <div className="text-center p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-lg">OAuth 처리 중...</p>
        </div>
      }>
        <OAuthCallbackContent />
      </Suspense>
    </div>
  );
}
