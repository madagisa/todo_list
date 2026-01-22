import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

const Login = () => {
    const [positionTitle, setPositionTitle] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [mode, setMode] = useState('login'); // 'login' or 'signup'
    const navigate = useNavigate();

    const handleAuth = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (mode === 'signup') {
                // 회원가입: 직책명 중복 확인 후 프로필 생성
                const { data: existing } = await supabase
                    .from('profiles')
                    .select('id')
                    .eq('position_title', positionTitle)
                    .single();

                if (existing) {
                    throw new Error('이미 등록된 직책명입니다.');
                }

                const { error: insertError } = await supabase
                    .from('profiles')
                    .insert([{
                        position_title: positionTitle,
                        password_hash: password, // 실제 운영시 bcrypt 해시 필요
                        role: 'user',
                        is_approved: false
                    }]);

                if (insertError) throw insertError;
                alert('가입 신청이 완료되었습니다. 관리자 승인 후 로그인이 가능합니다.');
                setMode('login');
                setPositionTitle('');
                setPassword('');
            } else {
                // 로그인: 직책명과 비밀번호 확인
                const { data: profile, error: fetchError } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('position_title', positionTitle)
                    .single();

                if (fetchError || !profile) {
                    throw new Error('등록되지 않은 직책명입니다.');
                }

                if (profile.password_hash !== password) {
                    throw new Error('비밀번호가 일치하지 않습니다.');
                }

                if (!profile.is_approved) {
                    throw new Error('관리자 승인 대기 중입니다. 승인 후 로그인이 가능합니다.');
                }

                // 세션 저장 (localStorage 사용)
                localStorage.setItem('currentUser', JSON.stringify(profile));
                navigate('/dashboard');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-[80vh]">
            <div className="w-full max-w-md p-8 glass-card">
                <div className="flex flex-col items-center mb-8">
                    <div className="mb-4 shadow-lg rounded-2xl overflow-hidden">
                        <img src="/app-icon.png" alt="KEPCO" className="h-16 w-16" />
                    </div>
                    <h1 className="text-2xl font-heading font-bold text-kepco-navy mb-1">
                        {mode === 'login' ? '로그인' : '가입하기'}
                    </h1>
                    <p className="text-sm text-kepco-gray">
                        KEPCO 대구본부장 일정 관리 시스템
                    </p>
                </div>

                <form onSubmit={handleAuth} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-kepco-navy mb-2">직책명</label>
                        <input
                            type="text"
                            required
                            className="input-field"
                            placeholder="예: 경영지원부장, 총무팀장"
                            value={positionTitle}
                            onChange={(e) => setPositionTitle(e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-kepco-navy mb-2">비밀번호</label>
                        <input
                            type="password"
                            required
                            className="input-field"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>

                    {error && (
                        <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full btn-primary flex justify-center items-center gap-2"
                    >
                        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                        {mode === 'login' ? '로그인' : '가입하기'}
                    </button>
                </form>

                <div className="mt-6 text-center text-sm">
                    <span className="text-gray-500">
                        {mode === 'login' ? "계정이 없으신가요? " : "이미 계정이 있으신가요? "}
                    </span>
                    <button
                        onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
                        className="text-kepco-blue font-semibold hover:underline"
                    >
                        {mode === 'login' ? '가입하기' : '로그인'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Login;
