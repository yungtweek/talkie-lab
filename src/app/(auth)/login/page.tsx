import { Github } from 'lucide-react';

import { signIn } from '@/app/(auth)/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const startGithubSignIn = async () => {
  'use server';
  await signIn('github', { redirectTo: '/chat' });
};

export default function LoginPage() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-gradient-to-br from-secondary/40 via-background to-accent/30 px-4 py-12">
      <Card className="w-full max-w-md backdrop-blur">
        <CardHeader className="space-y-3">
          <CardTitle className="text-2xl font-semibold">Talkie Lab에 오신 것을 환영해요</CardTitle>
          <CardDescription className="text-base leading-relaxed">
            별도의 회원 가입 없이 GitHub 계정으로 바로 로그인하고 대화와 프롬프트를 관리하세요.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            로그인하면 이전 대화를 이어서 볼 수 있고, 프롬프트를 저장해 빠르게 불러올 수 있습니다.
          </div>
          <form action={startGithubSignIn} className="space-y-2">
            <Button type="submit" size="lg" className="w-full">
              <Github className="size-5" />
              GitHub로 계속하기
            </Button>
            <p className="text-xs text-muted-foreground">
              승인 화면이 보이지 않을 경우 브라우저의 팝업 차단을 해제해주세요.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
