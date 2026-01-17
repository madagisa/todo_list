import React, { useState, useEffect } from 'react';
import { format, startOfWeek, addDays, startOfDay, endOfDay, parseISO, isSameDay, isToday, addWeeks, addMonths, addYears } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Plus, CheckCircle, Circle, Clock, Trash2, X, Loader2, AlertCircle, ChevronLeft, ChevronRight, Edit } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

const Dashboard = () => {
    // Calendar reference – start of the week that contains today (or navigated week)
    const [referenceDate, setReferenceDate] = useState(startOfWeek(new Date(), { weekStartsOn: 0 }));
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [calendarTasks, setCalendarTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [session, setSession] = useState(null);
    const [isAdmin, setIsAdmin] = useState(false);

    // Modal states
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editTask, setEditTask] = useState(null);
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [newTaskTime, setNewTaskTime] = useState('09:00');
    const [newTaskType, setNewTaskType] = useState('work');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Generate 35 days (5 weeks) grid based on referenceDate
    const calendarStartDate = startOfWeek(referenceDate, { weekStartsOn: 0 });
    const calendarDays = Array.from({ length: 35 }, (_, i) => addDays(calendarStartDate, i));
    const calendarEndDate = calendarDays[calendarDays.length - 1];

    // ----- Session & Role -----
    useEffect(() => {
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
                console.error('Session check failed', error);
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

    const checkUserRole = async (userId) => {
        const { data, error } = await supabase.from('profiles').select('role').eq('id', userId).single();
        if (data && data.role === 'admin') setIsAdmin(true);
        else setIsAdmin(false);
    };

    // ----- Fetch tasks for the 5‑week range -----
    useEffect(() => {
        if (session) fetchCalendarTasks();
    }, [referenceDate, session]);

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
        if (error) console.error('Error fetching tasks', error);
        else setCalendarTasks(data || []);
        setLoading(false);
    };

    // ----- Helpers -----
    const getTasksForDate = (date) =>
        calendarTasks.filter((task) => isSameDay(parseISO(task.start_time), date));

    const getHolidays = (year) => {
        const holidays = [
            `${year}-01-01`, `${year}-03-01`, `${year}-05-05`, `${year}-06-06`,
            `${year}-08-15`, `${year}-10-03`, `${year}-10-09`, `${year}-12-25`
        ];
        return holidays;
    };

    const isHoliday = (date) => {
        const year = date.getFullYear();
        const dateString = format(date, 'yyyy-MM-dd');
        return getHolidays(year).includes(dateString);
    };

    // ----- Task CRUD -----
    const handleAddTask = async (e) => {
        e.preventDefault();
        if (!isAdmin) return alert('관리자만 일정을 추가할 수 있습니다.');
        setIsSubmitting(true);
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        const dateTime = new Date(`${dateStr}T${newTaskTime}:00`);
        const { error } = await supabase.from('schedule_items').insert([
            {
                title: newTaskTitle,
                start_time: dateTime.toISOString(),
                end_time: dateTime.toISOString(),
                status: 'pending',
                user_id: session.user.id,
                description: newTaskType,
            },
        ]);
        if (error) alert('일정 추가 실패: ' + error.message);
        else {
            setIsModalOpen(false);
            setNewTaskTitle('');
            fetchCalendarTasks();
        }
        setIsSubmitting(false);
    };

    const handleEditTask = async (e) => {
        e.preventDefault();
        if (!isAdmin) return;
        setIsSubmitting(true);
        const dateStr = format(editTask.date, 'yyyy-MM-dd');
        const dateTime = new Date(`${dateStr}T${newTaskTime}:00`);
        const { error } = await supabase
            .from('schedule_items')
            .update({
                title: newTaskTitle,
                start_time: dateTime.toISOString(),
                end_time: dateTime.toISOString(),
                description: newTaskType,
            })
            .eq('id', editTask.id);
        if (error) alert('일정 수정 실패: ' + error.message);
        else {
            setIsEditModalOpen(false);
            setEditTask(null);
            fetchCalendarTasks();
        }
        setIsSubmitting(false);
    };

    const toggleTaskStatus = async (taskId, currentStatus) => {
        if (!isAdmin) return;
        const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
        const { error } = await supabase.from('schedule_items').update({ status: newStatus }).eq('id', taskId);
        if (!error) fetchCalendarTasks();
    };

    const deleteTask = async (taskId) => {
        if (!isAdmin) return;
        if (!confirm('정말 삭제하시겠습니까?')) return;
        const { error } = await supabase.from('schedule_items').delete().eq('id', taskId);
        if (!error) fetchCalendarTasks();
    };

    // ----- Navigation -----
    const goPrevWeek = () => setReferenceDate(addWeeks(referenceDate, -1));
    const goNextWeek = () => setReferenceDate(addWeeks(referenceDate, 1));
    const goPrevMonth = () => setReferenceDate(addMonths(referenceDate, -1));
    const goNextMonth = () => setReferenceDate(addMonths(referenceDate, 1));
    const goPrevYear = () => setReferenceDate(addYears(referenceDate, -1));
    const goNextYear = () => setReferenceDate(addYears(referenceDate, 1));

    // ----- UI -----
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
    const monthLabel = `${format(calendarStartDate, 'M월', { locale: ko })} - ${format(calendarEndDate, 'M월', { locale: ko })}`;

    return (
        <div className="flex flex-col lg:flex-row gap-8 relative h-full">
            {/* Left: Custom Calendar */}
            <div className="w-full lg:w-2/3 flex flex-col gap-4">
                <div className="glass-card p-6 flex-1 flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-heading font-bold text-kepco-navy">{monthLabel} 일정</h2>
                        <div className="flex gap-2 text-sm text-gray-600">
                            <button onClick={goPrevYear} className="p-1 hover:bg-gray-100 rounded"><ChevronLeft size={14} /></button>
                            <button onClick={goPrevMonth} className="p-1 hover:bg-gray-100 rounded"><ChevronLeft size={14} /></button>
                            <button onClick={goPrevWeek} className="p-1 hover:bg-gray-100 rounded"><ChevronLeft size={14} /></button>
                            <button onClick={goNextWeek} className="p-1 hover:bg-gray-100 rounded"><ChevronRight size={14} /></button>
                            <button onClick={goNextMonth} className="p-1 hover:bg-gray-100 rounded"><ChevronRight size={14} /></button>
                            <button onClick={goNextYear} className="p-1 hover:bg-gray-100 rounded"><ChevronRight size={14} /></button>
                        </div>
                    </div>
                    {/* Weekday header */}
                    <div className="grid grid-cols-7 mb-2">
                        {weekDays.map((d, i) => (
                            <div key={d} className={`text-center text-sm font-bold py-1 ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-600'}`}>{d}</div>
                        ))}
                    </div>
                    {/* Calendar grid */}
                    <div className="grid grid-cols-7 grid-rows-5 gap-px bg-gray-200 border border-gray-200 rounded-lg overflow-hidden">
                        {calendarDays.map((day) => {
                            const isSelected = isSameDay(day, selectedDate);
                            const isTodayDate = isToday(day);
                            const dayTasks = getTasksForDate(day);
                            const isRed = day.getDay() === 0 || isHoliday(day);
                            const isBlue = day.getDay() === 6 && !isHoliday(day);
                            return (
                                <div
                                    key={day.toISOString()}
                                    onClick={() => setSelectedDate(day)}
                                    className={`bg-white p-1 flex flex-col h-full min-h-[100px] cursor-pointer transition-colors relative ${isSelected ? 'bg-blue-50 ring-2 ring-kepco-blue' : 'hover:bg-gray-50'}`}
                                >
                                    <div className="flex justify-between items-center mb-1">
                                        <span className={`text-sm font-medium w-6 h-6 flex items-center justify-center rounded-full ${isTodayDate ? 'bg-kepco-navy text-white' : ''} ${!isTodayDate && isRed ? 'text-red-500' : ''} ${!isTodayDate && isBlue ? 'text-blue-500' : ''} ${!isTodayDate && !isRed && !isBlue ? 'text-gray-700' : ''}`}>{format(day, 'd')}</span>
                                    </div>
                                    <div className="flex flex-col gap-1 overflow-y-auto flex-1">
                                        {dayTasks.map((task) => (
                                            <div key={task.id} className={`text-[10px] px-1.5 py-0.5 rounded truncate font-medium border-l-2 ${task.status === 'completed' ? 'bg-gray-100 text-gray-400 border-gray-300 line-through' : 'bg-indigo-50 text-kepco-navy border-kepco-blue'}`} title={task.title}>
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

            {/* Right: Selected day details */}
            <div className="w-full lg:w-1/3 flex flex-col">
                <div className="glass-card p-6 h-full flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                        <div>
                            <h2 className="text-2xl font-heading font-bold text-kepco-navy">{format(selectedDate, 'M월 d일 (eee)', { locale: ko })}</h2>
                            <p className="text-kepco-gray text-sm">선택한 날짜의 일정</p>
                        </div>
                        {isAdmin && (
                            <button onClick={() => { setIsModalOpen(true); setNewTaskTitle(''); setNewTaskTime('09:00'); setNewTaskType('work'); }} className="btn-primary flex items-center gap-2 px-3 py-2 text-sm">
                                <Plus size={16} />
                                <span>추가</span>
                            </button>
                        )}
                    </div>
                    <div className="flex-1 space-y-3 overflow-y-auto pr-2 custom-scrollbar">
                        {loading ? (
                            <div className="flex justify-center items-center h-40 text-kepco-blue"><Loader2 className="animate-spin h-8 w-8" /></div>
                        ) : (
                            getTasksForDate(selectedDate).map((task) => (
                                <div key={task.id} className="group bg-white border border-gray-100 p-3 rounded-xl flex items-center justify-between hover:shadow-md transition-all">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <button onClick={() => toggleTaskStatus(task.id, task.status)} className={`transition-colors shrink-0 ${isAdmin ? 'cursor-pointer hover:text-kepco-blue' : 'cursor-default'}`} disabled={!isAdmin}>
                                            {task.status === 'completed' ? <CheckCircle className="text-green-500 w-5 h-5" /> : <Circle className="text-gray-300 w-5 h-5" />}
                                        </button>
                                        <div className="min-w-0">
                                            <h3 className={`font-semibold text-sm truncate ${task.status === 'completed' ? 'text-gray-400 line-through' : 'text-kepco-navy'}`}>{task.title}</h3>
                                            <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                                                <Clock size={10} />
                                                <span>{format(parseISO(task.start_time), 'HH:mm')}</span>
                                                {task.description && (
                                                    <span className="px-1.5 py-0.5 rounded-full text-[9px] uppercase font-bold bg-blue-50 text-kepco-blue">{task.description}</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    {isAdmin && (
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                                            <button onClick={() => { setEditTask({ ...task, date: parseISO(task.start_time) }); setNewTaskTitle(task.title); setNewTaskTime(format(parseISO(task.start_time), 'HH:mm')); setNewTaskType(task.description || 'work'); setIsEditModalOpen(true); }} className="p-1 text-gray-400 hover:text-kepco-blue" title="수정"><Edit size={14} /></button>
                                            <button onClick={() => deleteTask(task.id)} className="p-1 text-gray-400 hover:text-red-500" title="삭제"><Trash2 size={14} /></button>
                                        </div>
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
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${isAdmin ? 'bg-kepco-navy text-white' : 'bg-gray-200 text-gray-600'}`}>{isAdmin ? 'Admin' : 'Viewer'}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Add Task Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-heading font-bold text-kepco-navy">{format(selectedDate, 'M월 d일')} 일정 추가</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleAddTask} className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">제목</label>
                                <input type="text" value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} className="input-field text-sm" placeholder="예: 회의" required autoFocus />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">시간</label>
                                    <input type="time" value={newTaskTime} onChange={(e) => setNewTaskTime(e.target.value)} className="input-field text-sm" required />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">유형</label>
                                    <select value={newTaskType} onChange={(e) => setNewTaskType(e.target.value)} className="input-field text-sm">
                                        <option value="work">업무</option>
                                        <option value="visit">순시</option>
                                        <option value="meeting">회의</option>
                                        <option value="event">행사</option>
                                    </select>
                                </div>
                            </div>
                            <button type="submit" disabled={isSubmitting} className="w-full btn-primary flex justify-center items-center py-2.5 text-sm">
                                {isSubmitting ? <Loader2 className="animate-spin w-4 h-4" /> : '저장'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Task Modal */}
            {isEditModalOpen && editTask && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-heading font-bold text-kepco-navy">일정 수정</h3>
                            <button onClick={() => setIsEditModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleEditTask} className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">제목</label>
                                <input type="text" value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} className="input-field text-sm" required />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">시간</label>
                                    <input type="time" value={newTaskTime} onChange={(e) => setNewTaskTime(e.target.value)} className="input-field text-sm" required />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">유형</label>
                                    <select value={newTaskType} onChange={(e) => setNewTaskType(e.target.value)} className="input-field text-sm">
                                        <option value="work">업무</option>
                                        <option value="visit">순시</option>
                                        <option value="meeting">회의</option>
                                        <option value="event">행사</option>
                                    </select>
                                </div>
                            </div>
                            <button type="submit" disabled={isSubmitting} className="w-full btn-primary flex justify-center items-center py-2.5 text-sm">
                                {isSubmitting ? <Loader2 className="animate-spin w-4 h-4" /> : '수정'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
