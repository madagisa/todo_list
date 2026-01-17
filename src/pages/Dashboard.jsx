import React, { useState, useEffect } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { format, startOfDay, endOfDay, parseISO } from 'date-fns';
import { Plus, CheckCircle, Circle, Clock, Trash2, X, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

const Dashboard = () => {
    const [date, setDate] = useState(new Date());
    const [monthlyTasks, setMonthlyTasks] = useState([]); // Store all tasks for the current month
    const [loading, setLoading] = useState(true);
    const [session, setSession] = useState(null);
    const [isAdmin, setIsAdmin] = useState(false);

    // Derived state for the selected day's tasks
    const dailyTasks = monthlyTasks.filter(task => {
        const taskDate = parseISO(task.start_time);
        return taskDate.getDate() === date.getDate() &&
            taskDate.getMonth() === date.getMonth() &&
            taskDate.getFullYear() === date.getFullYear();
    });

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [newTaskTime, setNewTaskTime] = useState('09:00');
    const [newTaskType, setNewTaskType] = useState('work'); // 'work' | 'visit' | 'other'
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        // Check Session & Role
        const checkSession = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) {
                    setLoading(false);
                    return;
                }
                setSession(session);
                await checkUserRole(session.user.id);
            } catch (error) {
                console.error("Session check failed", error);
                setLoading(false);
            }
        };

        checkSession();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            if (!session) setLoading(false);
            else checkUserRole(session.user.id);
        });

        return () => subscription.unsubscribe();
    }, []);

    useEffect(() => {
        if (session) {
            fetchMonthlyTasks(date);
        }
    }, [date, session]); // Note: This fetches on every date change. Optimization: Only fetch if month changes.

    const checkUserRole = async (userId) => {
        const { data, error } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .single();

        if (data && data.role === 'admin') {
            setIsAdmin(true);
        } else {
            setIsAdmin(false);
        }
    };

    const fetchMonthlyTasks = async (currentDate) => {
        setLoading(true);
        // Optimize to fetch start/end of the MONTH, not day
        const start = startOfDay(new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)).toISOString();
        const end = endOfDay(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)).toISOString();

        const { data, error } = await supabase
            .from('schedule_items')
            .select('*')
            .gte('start_time', start)
            .lte('start_time', end)
            .order('start_time', { ascending: true });

        if (error) console.error('Error fetching tasks:', error);
        else setMonthlyTasks(data || []);
        setLoading(false);
    };

    const handleAddTask = async (e) => {
        e.preventDefault();
        if (!isAdmin) return alert("관리자만 일정을 추가할 수 있습니다.");

        setIsSubmitting(true);
        const dateStr = format(date, 'yyyy-MM-dd');
        const dateTime = new Date(`${dateStr}T${newTaskTime}:00`);

        const { error } = await supabase
            .from('schedule_items')
            .insert([
                {
                    title: newTaskTitle,
                    start_time: dateTime.toISOString(),
                    end_time: dateTime.toISOString(),
                    status: 'pending',
                    user_id: session.user.id,
                    description: newTaskType
                }
            ]);

        if (error) {
            alert('일정 추가 실패: ' + error.message);
        } else {
            setIsModalOpen(false);
            setNewTaskTitle('');
            fetchMonthlyTasks(date); // Refresh list
        }
        setIsSubmitting(false);
    };

    const toggleTaskStatus = async (taskId, currentStatus) => {
        if (!isAdmin) return;
        const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
        const { error } = await supabase
            .from('schedule_items')
            .update({ status: newStatus })
            .eq('id', taskId);

        if (!error) fetchMonthlyTasks(date);
    };

    const deleteTask = async (taskId) => {
        if (!isAdmin) return;
        if (!confirm('정말 삭제하시겠습니까?')) return;
        const { error } = await supabase
            .from('schedule_items')
            .delete()
            .eq('id', taskId);

        if (!error) fetchMonthlyTasks(date);
    };

    const getHolidays = (year) => {
        // Fixed holidays
        const holidays = [
            `${year}-01-01`, // New Year
            `${year}-03-01`, // Samiljeol
            `${year}-05-05`, // Children's Day
            `${year}-06-06`, // Memorial Day
            `${year}-08-15`, // Liberation Day
            `${year}-10-03`, // Foundation Day
            `${year}-10-09`, // Hangeul Day
            `${year}-12-25`, // Christmas
        ];

        // Specific handling for 2025 and 2026 (Lunar New Year, Chuseok, Buddha's Birthday, Substitute Holidays)
        if (year === 2025) {
            holidays.push(
                '2025-01-28', '2025-01-29', '2025-01-30', // Seollal
                '2025-03-03', // Substitute Samiljeol
                '2025-05-06', // Substitute Children's Day
                '2025-05-05', // Buddha's Birthday (Matches Children's Day)
                '2025-10-05', '2025-10-06', '2025-10-07', '2025-10-08', // Chuseok & extended
                // Add more specific substitutes if needed
            );
        } else if (year === 2026) {
            holidays.push(
                '2026-02-16', '2026-02-17', '2026-02-18', // Seollal
                '2026-03-02', // Substitute Samiljeol
                '2026-05-24', // Buddha's Birthday
                '2026-05-25', // Substitute Buddha's Birthday
                '2026-09-24', '2026-09-25', '2026-09-26', // Chuseok
                // Check substitutes logic as needed
            );
        } else if (year === 2027) {
            holidays.push(
                '2027-02-06', '2027-02-07', '2027-02-08', // Seollal
                '2027-02-09', // Substitute Seollal
                '2027-05-13', // Buddha's Birthday
                '2027-08-16', // Substitute Liberation Day (Sun -> Mon)
                '2027-09-14', '2027-09-15', '2027-09-16', // Chuseok
                '2027-10-04', // Substitute Foundation Day (Sun -> Mon)
            );
        }
        return holidays;
    };

    const isHoliday = (date) => {
        const year = date.getFullYear();
        const dateString = format(date, 'yyyy-MM-dd');
        const holidays = getHolidays(year);
        return holidays.includes(dateString);
    };

    const tileClassName = ({ date, view }) => {
        if (view === 'month') {
            const dayOfWeek = date.getDay(); // 0: Sun, 6: Sat
            const isRedDay = dayOfWeek === 0 || isHoliday(date);
            const isBlueDay = dayOfWeek === 6 && !isHoliday(date); // Saturday and not a holiday

            if (isRedDay) return 'holiday-tile'; // Red text & Red BG
            if (isBlueDay) return 'saturday-tile'; // Blue text & Blue BG
        }
        return null;
    };

    const tileContent = ({ date: tileDate, view }) => {
        if (view === 'month') {
            // Find tasks for this specific tile date
            const dayTasks = monthlyTasks.filter(task => {
                const taskDate = parseISO(task.start_time);
                return taskDate.getDate() === tileDate.getDate() &&
                    taskDate.getMonth() === tileDate.getMonth() &&
                    taskDate.getFullYear() === tileDate.getFullYear();
            });

            if (dayTasks.length > 0) {
                return (
                    <div className="flex flex-col gap-0.5 mt-1 items-start w-full px-1">
                        {dayTasks.slice(0, 2).map((task, i) => (
                            <div key={i} className="text-[9px] leading-tight text-left w-full truncate bg-blue-50 text-kepco-blue rounded px-1 py-0.5 font-medium">
                                {task.title}
                            </div>
                        ))}
                        {dayTasks.length > 2 && (
                            <div className="text-[8px] text-gray-400 pl-1">+ {dayTasks.length - 2} more</div>
                        )}
                    </div>
                );
            }
        }
        return null;
    };

    // Redirect or show login prompt if not authenticated and not loading
    if (!loading && !session) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
                <div className="glass-card p-8 text-center">
                    <AlertCircle className="h-12 w-12 text-kepco-blue mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-kepco-navy mb-2">로그인이 필요합니다</h2>
                    <p className="text-gray-600 mb-6">일정을 확인하려면 로그인이 필요합니다.</p>
                    <a href="/login" className="btn-primary inline-block">로그인 페이지로 이동</a>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col lg:flex-row gap-8 relative">
            {/* Left Column: Calendar */}
            <div className="w-full lg:w-1/3">
                <div className="glass-card p-6">
                    <h2 className="text-xl font-heading font-bold mb-4 text-kepco-navy">일정 달력</h2>
                    <div className="calendar-wrapper">
                        <Calendar
                            onChange={setDate}
                            value={date}
                            tileContent={tileContent}
                            tileClassName={tileClassName}
                            calendarType="gregory"
                            defaultView="month"
                            className="w-full border-none font-sans"
                            onActiveStartDateChange={({ activeStartDate }) => fetchMonthlyTasks(activeStartDate)}
                        />
                    </div>
                </div>

                {/* User Info / Role Badge */}
                <div className="mt-4 p-4 glass-card flex items-center justify-between">
                    <div>
                        <p className="text-xs text-kepco-gray uppercase font-bold">로그인 계정</p>
                        <p className="text-sm font-semibold truncate max-w-[150px]">{session?.user?.email}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${isAdmin ? 'bg-kepco-navy text-white' : 'bg-gray-200 text-gray-600'}`}>
                        {isAdmin ? '관리자 (Admin)' : '조회자 (Viewer)'}
                    </span>
                </div>
            </div>

            {/* Right Column: Task List */}
            <div className="w-full lg:w-2/3">
                <div className="glass-card p-6 min-h-[500px] flex flex-col">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h2 className="text-2xl font-heading font-bold text-kepco-navy">
                                {format(date, 'yyyy년 M월 d일')}
                            </h2>
                            <p className="text-kepco-gray text-sm">오늘의 일정</p>
                        </div>
                        {isAdmin && (
                            <button
                                onClick={() => setIsModalOpen(true)}
                                className="btn-primary flex items-center gap-2"
                            >
                                <Plus size={18} />
                                <span>일정 추가</span>
                            </button>
                        )}
                    </div>

                    <div className="flex-1 space-y-4 overflow-y-auto max-h-[600px] pr-2 custom-scrollbar">
                        {loading ? (
                            <div className="flex justify-center items-center h-40 text-kepco-blue">
                                <Loader2 className="animate-spin h-8 w-8" />
                            </div>
                        ) : dailyTasks.length === 0 ? (
                            <div className="text-center py-20 text-gray-400 flex flex-col items-center">
                                <div className="bg-gray-50 p-4 rounded-full mb-3">
                                    <Clock className="h-8 w-8 text-gray-300" />
                                </div>
                                <p>등록된 일정이 없습니다.</p>
                                {isAdmin && <p className="text-sm mt-2 text-kepco-blue cursor-pointer hover:underline" onClick={() => setIsModalOpen(true)}>일정 등록하기</p>}
                            </div>
                        ) : (
                            dailyTasks.map(task => (
                                <div key={task.id} className="group bg-white border border-gray-100 p-4 rounded-xl flex items-center justify-between hover:shadow-lg transition-all duration-300">
                                    <div className="flex items-center gap-4">
                                        <button
                                            onClick={() => toggleTaskStatus(task.id, task.status)}
                                            className={`transition-colors ${isAdmin ? 'cursor-pointer hover:text-kepco-blue' : 'cursor-default'}`}
                                            disabled={!isAdmin}
                                        >
                                            {task.status === 'completed' ? <CheckCircle className="text-green-500" /> : <Circle className="text-gray-300" />}
                                        </button>
                                        <div>
                                            <h3 className={`font-semibold text-lg ${task.status === 'completed' ? 'text-gray-400 line-through' : 'text-kepco-navy'}`}>
                                                {task.title}
                                            </h3>
                                            <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                                                <Clock size={12} />
                                                <span>{format(parseISO(task.start_time), 'HH:mm')}</span>
                                                {task.description && (
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold bg-blue-50 text-kepco-blue`}>
                                                        {task.description}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {isAdmin && (
                                        <button
                                            onClick={() => deleteTask(task.id)}
                                            className="opacity-0 group-hover:opacity-100 p-2 text-gray-300 hover:text-red-500 transition-all"
                                            title="삭제"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Add Task Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-heading font-bold text-kepco-navy">새 일정 추가</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleAddTask} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">제목</label>
                                <input
                                    type="text"
                                    value={newTaskTitle}
                                    onChange={(e) => setNewTaskTitle(e.target.value)}
                                    className="input-field"
                                    placeholder="예: 본부장 주간 회의"
                                    required
                                    autoFocus
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">시간</label>
                                    <input
                                        type="time"
                                        value={newTaskTime}
                                        onChange={(e) => setNewTaskTime(e.target.value)}
                                        className="input-field"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">유형</label>
                                    <select
                                        value={newTaskType}
                                        onChange={(e) => setNewTaskType(e.target.value)}
                                        className="input-field"
                                    >
                                        <option value="work">업무</option>
                                        <option value="visit">순시</option>
                                        <option value="meeting">회의</option>
                                        <option value="event">행사</option>
                                    </select>
                                </div>
                            </div>

                            <div className="pt-2">
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="w-full btn-primary flex justify-center items-center py-3 text-lg"
                                >
                                    {isSubmitting ? <Loader2 className="animate-spin" /> : '일정 저장'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
