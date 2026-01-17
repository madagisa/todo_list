import React, { useState, useEffect } from 'react';
import { format, startOfWeek, addDays, startOfDay, endOfDay, parseISO, isSameDay, isToday } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Plus, CheckCircle, Circle, Clock, Trash2, X, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

const Dashboard = () => {
    // State for the reference date (usually today, but could allow navigation)
    const [referenceDate] = useState(new Date());
    const [calendarTasks, setCalendarTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [session, setSession] = useState(null);
    const [isAdmin, setIsAdmin] = useState(false);

    // Derived state for the selected day for the right panel (default to today if in range, otherwise first day)
    const [selectedDate, setSelectedDate] = useState(new Date());

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [newTaskTime, setNewTaskTime] = useState('09:00');
    const [newTaskType, setNewTaskType] = useState('work'); // 'work' | 'visit' | 'other'
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Calculate the 35 days (5 weeks) to display
    // Start from the Sunday of the week containing the reference date
    const calendarStartDate = startOfWeek(referenceDate, { weekStartsOn: 0 });
    const calendarDays = Array.from({ length: 35 }, (_, i) => addDays(calendarStartDate, i));
    const calendarEndDate = calendarDays[calendarDays.length - 1];

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
            fetchCalendarTasks();
        }
    }, [referenceDate, session]);

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

    const fetchCalendarTasks = async () => {
        setLoading(true);
        const start = startOfDay(calendarStartDate).toISOString();
        const end = endOfDay(calendarEndDate).toISOString();

        const { data, error } = await supabase
            .from('schedule_items')
            .select('*')
            .gte('start_time', start)
            .lte('start_time', end)
            .order('start_time', { ascending: true });

        if (error) console.error('Error fetching tasks:', error);
        else setCalendarTasks(data || []);
        setLoading(false);
    };

    const handleAddTask = async (e) => {
        e.preventDefault();
        if (!isAdmin) return alert("관리자만 일정을 추가할 수 있습니다.");

        setIsSubmitting(true);
        // Add task to the currently selected date
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
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
            fetchCalendarTasks(); // Refresh list
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

        if (!error) fetchCalendarTasks();
    };

    const deleteTask = async (taskId) => {
        if (!isAdmin) return;
        if (!confirm('정말 삭제하시겠습니까?')) return;
        const { error } = await supabase
            .from('schedule_items')
            .delete()
            .eq('id', taskId);

        if (!error) fetchCalendarTasks();
    };

    // Filter tasks for a specific date
    const getTasksForDate = (date) => {
        return calendarTasks.filter(task => {
            const taskDate = parseISO(task.start_time);
            return isSameDay(taskDate, date);
        });
    };

    // Derived state for the selected day's tasks (for the right panel)
    const selectedDayTasks = getTasksForDate(selectedDate);

    // Holiday Check (Simplified for display)
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
            );
        } else if (year === 2026) {
            holidays.push(
                '2026-02-16', '2026-02-17', '2026-02-18', // Seollal
                '2026-03-02', // Substitute Samiljeol
                '2026-05-24', // Buddha's Birthday
                '2026-05-25', // Substitute Buddha's Birthday
                '2026-09-24', '2026-09-25', '2026-09-26', // Chuseok
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

    const weekDays = ['일', '월', '화', '수', '목', '금', '토'];

    return (
        <div className="flex flex-col lg:flex-row gap-8 relative h-full">
            {/* Left Column: Custom Calendar (5 Weeks) */}
            <div className="w-full lg:w-2/3 flex flex-col gap-4">
                <div className="glass-card p-6 flex-1 flex flex-col">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-heading font-bold text-kepco-navy">
                            {format(calendarStartDate, 'M월 d일', { locale: ko })} - {format(calendarEndDate, 'M월 d일', { locale: ko })} 일정
                        </h2>
                        {/* Use today button to reset view if we add navigation later */}
                        <div className="text-sm text-gray-500 font-medium">
                            오늘 기준 향후 5주
                        </div>
                    </div>

                    <div className="grid grid-cols-7 mb-2">
                        {weekDays.map((day, index) => (
                            <div key={day} className={`text-center text-sm font-bold py-2 ${index === 0 ? 'text-red-500' : index === 6 ? 'text-blue-500' : 'text-gray-600'}`}>
                                {day}
                            </div>
                        ))}
                    </div>

                    <div className="flex-1 grid grid-cols-7 grid-rows-5 gap-px bg-gray-200 border border-gray-200 rounded-lg overflow-hidden">
                        {calendarDays.map((day, index) => {
                            const isSelected = isSameDay(day, selectedDate);
                            const isTodayDate = isToday(day);
                            const dayTasks = getTasksForDate(day);
                            const isRedDay = day.getDay() === 0 || isHoliday(day);
                            const isBlueDay = day.getDay() === 6 && !isHoliday(day);

                            return (
                                <div
                                    key={day.toISOString()}
                                    onClick={() => setSelectedDate(day)}
                                    className={`
                                        bg-white p-1 flex flex-col h-full min-h-[100px] cursor-pointer transition-colors relative
                                        ${isSelected ? 'bg-blue-50/50 ring-2 ring-inset ring-kepco-blue z-10' : 'hover:bg-gray-50'}
                                    `}
                                >
                                    <div className="flex justify-between items-center mb-1">
                                        <span className={`
                                            text-sm font-medium w-6 h-6 flex items-center justify-center rounded-full
                                            ${isTodayDate ? 'bg-kepco-navy text-white' : ''}
                                            ${!isTodayDate && isRedDay ? 'text-red-500' : ''}
                                            ${!isTodayDate && isBlueDay ? 'text-blue-500' : ''}
                                            ${!isTodayDate && !isRedDay && !isBlueDay ? 'text-gray-700' : ''}
                                        `}>
                                            {format(day, 'd')}
                                        </span>
                                    </div>

                                    <div className="flex flex-col gap-1 overflow-y-auto custom-scrollbar flex-1">
                                        {dayTasks.map((task) => (
                                            <div
                                                key={task.id}
                                                className={`
                                                    text-[10px] px-1.5 py-0.5 rounded truncate font-medium border-l-2
                                                    ${task.status === 'completed'
                                                        ? 'bg-gray-100 text-gray-400 border-gray-300 line-through'
                                                        : 'bg-indigo-50 text-kepco-navy border-kepco-blue'}
                                                `}
                                                title={task.title}
                                            >
                                                {task.title}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Right Column: Selected Day Details */}
            <div className="w-full lg:w-1/3 flex flex-col">
                <div className="glass-card p-6 h-full flex flex-col">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h2 className="text-2xl font-heading font-bold text-kepco-navy">
                                {format(selectedDate, 'M월 d일 (eee)', { locale: ko })}
                            </h2>
                            <p className="text-kepco-gray text-sm">선택한 날짜의 일정</p>
                        </div>
                        {isAdmin && (
                            <button
                                onClick={() => setIsModalOpen(true)}
                                className="btn-primary flex items-center gap-2 px-3 py-2 text-sm"
                            >
                                <Plus size={16} />
                                <span>추가</span>
                            </button>
                        )}
                    </div>

                    <div className="flex-1 space-y-3 overflow-y-auto pr-2 custom-scrollbar">
                        {loading ? (
                            <div className="flex justify-center items-center h-40 text-kepco-blue">
                                <Loader2 className="animate-spin h-8 w-8" />
                            </div>
                        ) : selectedDayTasks.length === 0 ? (
                            <div className="text-center py-20 text-gray-400 flex flex-col items-center">
                                <div className="bg-gray-50 p-4 rounded-full mb-3">
                                    <Clock className="h-8 w-8 text-gray-300" />
                                </div>
                                <p>일정이 없습니다.</p>
                            </div>
                        ) : (
                            selectedDayTasks.map(task => (
                                <div key={task.id} className="group bg-white border border-gray-100 p-3 rounded-xl flex items-center justify-between hover:shadow-md transition-all">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <button
                                            onClick={() => toggleTaskStatus(task.id, task.status)}
                                            className={`transition-colors shrink-0 ${isAdmin ? 'cursor-pointer hover:text-kepco-blue' : 'cursor-default'}`}
                                            disabled={!isAdmin}
                                        >
                                            {task.status === 'completed' ? <CheckCircle className="text-green-500 w-5 h-5" /> : <Circle className="text-gray-300 w-5 h-5" />}
                                        </button>
                                        <div className="min-w-0">
                                            <h3 className={`font-semibold text-sm truncate ${task.status === 'completed' ? 'text-gray-400 line-through' : 'text-kepco-navy'}`}>
                                                {task.title}
                                            </h3>
                                            <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                                                <div className="flex items-center gap-1 shrink-0">
                                                    <Clock size={10} />
                                                    <span>{format(parseISO(task.start_time), 'HH:mm')}</span>
                                                </div>
                                                {task.description && (
                                                    <span className={`px-1.5 py-0.5 rounded-full text-[9px] uppercase font-bold bg-blue-50 text-kepco-blue shrink-0`}>
                                                        {task.description}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {isAdmin && (
                                        <button
                                            onClick={() => deleteTask(task.id)}
                                            className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-300 hover:text-red-500 transition-all shrink-0"
                                            title="삭제"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    )}
                                </div>
                            ))
                        )}
                    </div>

                    <div className="mt-4 pt-4 border-t border-gray-100">
                        <div className="flex items-center justify-between text-xs text-gray-500">
                            <div>
                                <p className="font-bold text-kepco-navy">로그인 계정</p>
                                <p className="truncate max-w-[120px]">{session?.user?.email}</p>
                            </div>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${isAdmin ? 'bg-kepco-navy text-white' : 'bg-gray-200 text-gray-600'}`}>
                                {isAdmin ? 'Admin' : 'Viewer'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Add Task Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-heading font-bold text-kepco-navy">
                                {format(selectedDate, 'M월 d일')} 일정 추가
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleAddTask} className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">제목</label>
                                <input
                                    type="text"
                                    value={newTaskTitle}
                                    onChange={(e) => setNewTaskTitle(e.target.value)}
                                    className="input-field text-sm"
                                    placeholder="일정 내용을 입력하세요"
                                    required
                                    autoFocus
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">시간</label>
                                    <input
                                        type="time"
                                        value={newTaskTime}
                                        onChange={(e) => setNewTaskTime(e.target.value)}
                                        className="input-field text-sm"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">유형</label>
                                    <select
                                        value={newTaskType}
                                        onChange={(e) => setNewTaskType(e.target.value)}
                                        className="input-field text-sm"
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
                                    className="w-full btn-primary flex justify-center items-center py-2.5 text-sm"
                                >
                                    {isSubmitting ? <Loader2 className="animate-spin w-4 h-4" /> : '저장'}
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
