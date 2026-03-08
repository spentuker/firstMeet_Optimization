import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import MainLayout from '../components/MainLayout';
import '../styles/homePage.css';

const CompletedTasksPage = () => {
    const [completedTasks, setCompletedTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const tasksPerPage = 10;
    const navigate = useNavigate();

    useEffect(() => {
        const fetchCompleted = async () => {
            const userName = localStorage.getItem('userName');
            if (!userName) {
                navigate('/signin');
                return;
            }
            try {
                const res = await api.get(`/api/tasks/completed/${userName}`);
                setCompletedTasks(res.data);
            } catch (error) {
                console.error('Error fetching completed tasks:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchCompleted();
    }, [navigate]);

    const formatDate = (dateStr) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    const totalPages = Math.ceil(completedTasks.length / tasksPerPage);
    const pagedCompleted = completedTasks.slice((page - 1) * tasksPerPage, page * tasksPerPage);

    return (
        <MainLayout>
            <div className="content-area">
                <header className="home-greeting">
                    <h2 className="content-title">Completed Tasks</h2>
                </header>

                {loading ? (
                    <p className="empty-msg">Loading...</p>
                ) : completedTasks.length === 0 ? (
                    <div className="completed-empty">
                        <div className="completed-empty-icon">✓</div>
                        <p className="empty-msg">No completed tasks yet. Complete tasks from the homepage!</p>
                    </div>
                ) : (
                    <>
                        <ul className="task-list completed-task-list">
                            {pagedCompleted.map(task => (
                                <li key={task._id} className="task-item completed-task-item">
                                    <div className="completed-check-badge">✓</div>
                                    <div className="task-item-content">
                                        <strong>{task.title}</strong>
                                        {task.assignedBy && <p>Assigned by: {task.assignedBy}</p>}
                                        <p>Deadline: {task.deadline || 'Flexible'}</p>
                                        <p className="completed-on">Completed on: {formatDate(task.updatedAt)}</p>
                                        {task.priority && (
                                            <span className={`priority-tag ${task.priority.toLowerCase()}`}>
                                                {task.priority}
                                            </span>
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ul>
                        {totalPages > 1 && (
                            <div className="pagination">
                                <button disabled={page === 1} onClick={() => setPage(page - 1)}>Prev</button>
                                <span>{page} / {totalPages}</span>
                                <button disabled={page === totalPages} onClick={() => setPage(page + 1)}>Next</button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </MainLayout>
    );
};

export default CompletedTasksPage;

