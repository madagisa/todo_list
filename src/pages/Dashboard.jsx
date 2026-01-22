import React, { useState, useEffect } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { format, startOfDay, endOfDay, parseISO, isToday } from 'date-fns';
import { Plus, CheckCircle, Circle, Clock, Trash2, X, Loader2, AlertCircle, Edit, UserCheck, UserX, LogOut } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
    const [date, setDate] = useState(new Date());
    const [monthlyTasks, setMonthlyTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [pendingUsers, setPendingUsers] = useState([]);
    const navigate = useNavigate();

    // Derived state for the selected day's tasks
    const dailyTasks = monthlyTasks.filter(task => {
        const taskDate = parseISO(task.start_time);
        return taskDate.getDate() === date.getDate() &&
            taskDate.getMonth() === date.getMonth() &&
            taskDate.getFullYear() === date.getFullYear();
    });

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editTask, setEditTask] = useState(null);
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [newTaskTime, setNewTaskTime] = useState('09:00');
    const [newTaskType, setNewTaskType] = useState('work');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const user = localStorage.getItem('currentUser');
        if (!user) {
            navigate('/login');
            return;
        }
        const parsedUser = JSON.parse(user);
        setCurrentUser(parsedUser);
        setIsAdmin(parsedUser.role === 'admin');
        setLoading(false);
    }, [navigate]);

    useEffect(() => {
        if (currentUser) {
            fetchMonthlyTasks(date);
            if (isAdmin) {
                fetchPendingUsers();
            }
        }
    }, [date, currentUser, isAdmin]);

    const fetchPendingUsers = async () => {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('is_approved', false)
            .order('created_at', { ascending: true });

        if (!error) setPendingUsers(data || []);
    };

    const handleApproveUser = async (userId) => {
        const { error } = await supabase
            .from('profiles')
            .update({ is_approved: true })
            .eq('id', userId);

        if (!error) fetchPendingUsers();
    };

    const handleRejectUser = async (userId) => {
        if (!confirm('정말 이 가입 신청을 거절하시겠습니까? 해당 계정이 삭제됩니다.')) return;
        const { error } = await supabase
            .from('profiles')
            .delete()
            .eq('id', userId);

        if (!error) fetchPendingUsers();
    };

    const handleWithdraw = async () => {
        if (!confirm('정말 탈퇴하시겠습니까? 모든 데이터가 삭제됩니다.')) return;
        const { error } = await supabase
            .from('profiles')
            .delete()
            .eq('id', currentUser.id);

        if (!error) {
            localStorage.removeItem('currentUser');
            navigate('/login');
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('currentUser');
        navigate('/login');
    };

    const fetchMonthlyTasks = async (currentDate) => {
        setLoading(true);
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
                    user_id: currentUser.id,
                    description: newTaskType
                }
            ]);

        if (error) {
            alert('일정 추가 실패: ' + error.message);
        } else {
            setIsModalOpen(false);
            setNewTaskTitle('');
            fetchMonthlyTasks(date);
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

    const handleEditTask = async (e) => {
        e.preventDefault();
        if (!isAdmin || !editTask) return;
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
        if (error) {
            alert('일정 수정 실패: ' + error.message);
        } else {
            setIsEditModalOpen(false);
            setEditTask(null);
            fetchMonthlyTasks(date);
        }
        setIsSubmitting(false);
    };

    const getHolidays = (year) => {
        const holidays = [
            `${year}-01-01`, `${year}-03-01`, `${year}-05-05`, `${year}-06-06`,
            `${year}-08-15`, `${year}-10-03`, `${year}-10-09`, `${year}-12-25`,
        ];
        if (year === 2025) {
            holidays.push('2025-01-28', '2025-01-29', '2025-01-30', '2025-03-03', '2025-05-06', '2025-05-05', '2025-10-05', '2025-10-06', '2025-10-07', '2025-10-08');
        } else if (year === 2026) {
            holidays.push('2026-02-16', '2026-02-17', '2026-02-18', '2026-03-02', '2026-05-24', '2026-05-25', '2026-09-24', '2026-09-25', '2026-09-26');
        } else if (year === 2027) {
            holidays.push('2027-02-06', '2027-02-07', '2027-02-08', '2027-02-09', '2027-05-13', '2027-08-16', '2027-09-14', '2027-09-15', '2027-09-16', '2027-10-04');
        }
        return holidays;
    };

    const isHoliday = (date) => {
        const year = date.getFullYear();
        const dateString = format(date, 'yyyy-MM-dd');
        return getHolidays(year).includes(dateString);
    };

    const tileClassName = ({ date: tileDate, view }) => {
        if (view === 'month') {
            const classes = [];
            if (isToday(tileDate)) classes.push('today-tile');
            if (date && tileDate.getTime() === date.getTime()) classes.push('selected-tile');
            const dayOfWeek = tileDate.getDay();
            const isRedDay = dayOfWeek === 0 || isHoliday(tileDate);
            const isBlueDay = dayOfWeek === 6 && !isHoliday(tileDate);
            if (isRedDay) classes.push('holiday-tile');
            else if (isBlueDay) classes.push('saturday-tile');
            return classes.join(' ');
        }
        return null;
    };

    const tileContent = ({ date: tileDate, view }) => {
        if (view === 'month') {
            const dayTasks = monthlyTasks.filter(task => {
                const taskDate = parseISO(task.start_time);
                return taskDate.getDate() === tileDate.getDate() &&
                    taskDate.getMonth() === tileDate.getMonth() &&
                    taskDate.getFullYear() === tileDate.getFullYear();
            });
            if (dayTasks.length > 0) {
                return (
                    <div className="flex flex-col gap-0.5 mt-1 items-start w-full">
                        {dayTasks.map((task, i) => (
                            <div key={i} className="tile-task text-[9px] leading-tight text-left w-full">
                                {task.title.slice(0, 5)}
                            </div>
                        ))}
                    </div>
                );
            }
        }
        return null;
    };

    if (!currentUser) {
        return (
            <div className="flex justify-center items-center min-h-[50vh]">
                <Loader2 className="animate-spin h-8 w-8 text-kepco-blue" />
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

                {/* User Info */}
                <div className="mt-4 p-4 glass-card">
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <p className="text-xs text-kepco-gray uppercase font-bold">로그인 계정</p>
                            <p className="text-sm font-semibold truncate max-w-[150px]">{currentUser?.position_title}</p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${isAdmin ? 'bg-kepco-navy text-white' : 'bg-gray-200 text-gray-600'}`}>
                            {isAdmin ? '관리자' : '조회자'}
                        </span>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handleLogout} className="flex-1 py-2 px-3 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center justify-center gap-1 transition-colors">
                            <LogOut size={14} /> 로그아웃
                        </button>
                        <button onClick={handleWithdraw} className="py-2 px-3 text-sm bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors">
                            탈퇴
                        </button>
                    </div>
                </div>

                {/* Admin: Pending Users */}
                {isAdmin && pendingUsers.length > 0 && (
                    <div className="mt-4 p-4 glass-card">
                        <h3 className="text-sm font-bold text-kepco-navy mb-3">가입 대기자 ({pendingUsers.length}명)</h3>
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                            {pendingUsers.map(user => (
                                <div key={user.id} className="flex items-center justify-between bg-white p-2 rounded-lg border">
                                    <span className="text-sm font-medium">{user.position_title}</span>
                                    <div className="flex gap-1">
                                        <button onClick={() => handleApproveUser(user.id)} className="p-1.5 bg-green-100 hover:bg-green-200 text-green-600 rounded" title="승인">
                                            <UserCheck size={14} />
                                        </button>
                                        <button onClick={() => handleRejectUser(user.id)} className="p-1.5 bg-red-100 hover:bg-red-200 text-red-600 rounded" title="거절">
                                            <UserX size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
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
                            <button onClick={() => setIsModalOpen(true)} className="btn-primary flex items-center gap-2">
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
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] uppercase font-bold bg-blue-50 text-kepco-blue">
                                                        {task.description}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {isAdmin && (
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => {
                                                    setEditTask({ ...task, date: parseISO(task.start_time) });
                                                    setNewTaskTitle(task.title);
                                                    setNewTaskTime(format(parseISO(task.start_time), 'HH:mm'));
                                                    setNewTaskType(task.description || 'work');
                                                    setIsEditModalOpen(true);
                                                }}
                                                className="p-1 text-gray-400 hover:text-kepco-blue"
                                                title="수정"
                                            >
                                                <Edit size={14} />
                                            </button>
                                            <button onClick={() => deleteTask(task.id)} className="p-1 text-gray-400 hover:text-red-500" title="삭제">
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
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
                                <input type="text" value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} className="input-field" placeholder="예: 본부장 주간 회의" required autoFocus />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">시간</label>
                                    <input type="time" value={newTaskTime} onChange={(e) => setNewTaskTime(e.target.value)} className="input-field" required />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">유형</label>
                                    <select value={newTaskType} onChange={(e) => setNewTaskType(e.target.value)} className="input-field">
                                        <option value="work">업무</option>
                                        <option value="visit">순시</option>
                                        <option value="meeting">회의</option>
                                        <option value="event">행사</option>
                                    </select>
                                </div>
                            </div>

                            <div className="pt-2">
                                <button type="submit" disabled={isSubmitting} className="w-full btn-primary flex justify-center items-center py-3 text-lg">
                                    {isSubmitting ? <Loader2 className="animate-spin" /> : '일정 저장'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Task Modal */}
            {isEditModalOpen && editTask && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-heading font-bold text-kepco-navy">일정 수정</h3>
                            <button onClick={() => { setIsEditModalOpen(false); setEditTask(null); }} className="text-gray-400 hover:text-gray-600">
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleEditTask} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">제목</label>
                                <input type="text" value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} className="input-field" required />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">시간</label>
                                    <input type="time" value={newTaskTime} onChange={(e) => setNewTaskTime(e.target.value)} className="input-field" required />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">유형</label>
                                    <select value={newTaskType} onChange={(e) => setNewTaskType(e.target.value)} className="input-field">
                                        <option value="work">업무</option>
                                        <option value="visit">순시</option>
                                        <option value="meeting">회의</option>
                                        <option value="event">행사</option>
                                    </select>
                                </div>
                            </div>

                            <div className="pt-2">
                                <button type="submit" disabled={isSubmitting} className="w-full btn-primary flex justify-center items-center py-3 text-lg">
                                    {isSubmitting ? <Loader2 className="animate-spin" /> : '수정 저장'}
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
