import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Logic Engine ---
class Subject {
    name: string;
    credits: number;
    isLab: boolean;
    duration: number;
    constructor(name: string, credits: number, isLab = false, duration = 1) {
        this.name = name; this.credits = credits; this.isLab = isLab; this.duration = duration;
    }
}

class Teacher {
    initials: string;
    constructor(initials: string) { this.initials = initials; }
}

class Session {
    teacher: Teacher;
    subject: Subject;
    depts: string[];
    sem: number;
    isCombined: boolean;
    constructor(teacher: Teacher, subject: Subject, depts: string[], sem: number, isCombined = false) {
        this.teacher = teacher; this.subject = subject; this.depts = depts; this.sem = sem; this.isCombined = isCombined;
    }
}

class Timetable {
    dept: string;
    sem: number;
    slots: string[];
    breakIndices: Set<number>;
    days: number;
    grid: (Session | string | null)[][];
    constructor(dept: string, sem: number, slots: string[], breakIndices: number[]) {
        this.dept = dept; this.sem = sem; this.slots = slots; this.breakIndices = new Set(breakIndices);
        this.days = 5;
        this.grid = Array.from({ length: 5 }, () => 
            Array.from({ length: slots.length }, (_, i) => this.breakIndices.has(i) ? "BREAK" : null));
    }
}

class Scheduler {
    allTimetables: Map<string, Timetable>;
    allSessions: Session[];
    slotsCount: number;
    breakIndices: Set<number>;
    units: Session[];
    teacherBusy: Set<string>;
    placedCounts: Map<Session, number>;
    subjectTracking: Map<string, { [day: number]: number }>;
    labTracking: Map<string, boolean>;

    constructor(allTimetables: Map<string, Timetable>, allSessions: Session[], slotsCount: number, breakIndices: number[]) {
        this.allTimetables = allTimetables; this.allSessions = allSessions;
        this.slotsCount = slotsCount; this.breakIndices = new Set(breakIndices);
        this.units = [];
        allSessions.forEach(s => { 
            const sessionCount = Math.max(1, Math.floor(s.subject.credits / s.subject.duration));
            for (let i = 0; i < sessionCount; i++) this.units.push(s); 
        });
        this.units.sort((a, b) => (Number(b.isCombined) - Number(a.isCombined)) || (Number(b.subject.isLab) - Number(a.subject.isLab)) || (b.subject.duration - a.subject.duration));
        this.teacherBusy = new Set(); this.placedCounts = new Map();
        this.subjectTracking = new Map(); this.labTracking = new Map();
    }

    _placed(s: Session) { return this.placedCounts.get(s) || 0; }

    isSafe(session: Session, day: number, slot: number) {
        const duration = session.subject.duration;
        if (slot + duration > this.slotsCount) return false;
        for (let s = slot; s < slot + duration; s++) if (this.breakIndices.has(s)) return false;
        if (this._placed(session) >= session.subject.credits) return false;
        // Check teacher busy (if not TBA)
        if (session.teacher.initials !== "TBA") {
            for (let s = slot; s < slot + duration; s++) {
                if (this.teacherBusy.has(`${session.teacher.initials}-${day}-${s}`)) return false;
            }
        }

        for (const dept of session.depts) {
            const tt = this.allTimetables.get(`${dept}-${session.sem}`);
            if (!tt) continue;
            for (let s = slot; s < slot + duration; s++) if (tt.grid[day][s] !== null) return false;
            if (session.subject.isLab) { if (this.labTracking.get(`${dept}-${session.sem}-${day}`)) return false; }
            else {
                const key = `${dept}-${session.sem}-${session.subject.name}`;
                const subjDays = this.subjectTracking.get(key) || {};
                if (subjDays[day]) {
                    if (Object.keys(subjDays).length < 5) return false;
                }
            }
        }
        return true;
    }

    place(session: Session, day: number, slot: number) {
        const duration = session.subject.duration;
        for (const dept of session.depts) {
            const tt = this.allTimetables.get(`${dept}-${session.sem}`);
            if (!tt) continue;
            for (let s = slot; s < slot + duration; s++) tt.grid[day][s] = session;
            if (session.subject.isLab) this.labTracking.set(`${dept}-${session.sem}-${day}`, true);
            else {
                const key = `${dept}-${session.sem}-${session.subject.name}`;
                if (!this.subjectTracking.has(key)) this.subjectTracking.set(key, {});
                const tracking = this.subjectTracking.get(key)!;
                tracking[day] = (tracking[day] || 0) + 1;
            }
        }
        for (let s = slot; s < slot + duration; s++) {
            if (session.teacher.initials !== "TBA") this.teacherBusy.add(`${session.teacher.initials}-${day}-${s}`);
        }
        this.placedCounts.set(session, this._placed(session) + 1);
    }

    unplace(session: Session, day: number, slot: number) {
        const duration = session.subject.duration;
        for (const dept of session.depts) {
            const tt = this.allTimetables.get(`${dept}-${session.sem}`);
            if (!tt) continue;
            for (let s = slot; s < slot + duration; s++) tt.grid[day][s] = null;
            if (session.subject.isLab) this.labTracking.delete(`${dept}-${session.sem}-${day}`);
            else {
                const key = `${dept}-${session.sem}-${session.subject.name}`;
                const daysDict = this.subjectTracking.get(key);
                if (daysDict && daysDict[day]) { daysDict[day]--; if (daysDict[day] <= 0) delete daysDict[day]; }
            }
        }
        for (let s = slot; s < slot + duration; s++) {
            if (session.teacher.initials !== "TBA") this.teacherBusy.delete(`${session.teacher.initials}-${day}-${s}`);
        }
        this.placedCounts.set(session, this._placed(session) - 1);
    }

    solve() {
        const usableSlots = Array.from({ length: this.slotsCount }, (_, i) => i).filter(i => !this.breakIndices.has(i));
        const backtrack = (unitIdx: number): boolean => {
            if (unitIdx === this.units.length) return true;
            const unit = this.units[unitIdx];
            const days = [0, 1, 2, 3, 4].sort(() => Math.random() - 0.5);
            for (const d of days) {
                for (const s of usableSlots) {
                    if (this.isSafe(unit, d, s)) {
                        this.place(unit, d, s);
                        if (backtrack(unitIdx + 1)) return true;
                        this.unplace(unit, d, s);
                    }
                }
            }
            return false;
        };
        return backtrack(0);
    }
}

async function startServer() {
    const app = express();
    const PORT = 3000;

    app.use(cors());
    app.use(express.json());

    // --- API Routes ---
    app.post('/api/generate', (req, res) => {
        try {
            const { depts, sessions, slots, breakIndices } = req.body;

            const timetables = new Map<string, Timetable>();
            depts.forEach((d: any) => {
                timetables.set(`${d.code}-1`, new Timetable(d.code, 1, slots, breakIndices));
            });

            const sessionObjects = sessions.map((s: any) => {
                const subj = new Subject(s.name, s.credits, s.isLab, s.duration);
                const teach = new Teacher(s.teacherInitials);
                return new Session(teach, subj, s.depts, 1, s.isCombined);
            });

            const scheduler = new Scheduler(timetables, sessionObjects, slots.length, breakIndices);
            const success = scheduler.solve();

            if (success) {
                const result: any = {};
                timetables.forEach((v, k) => { 
                    // Convert grid to a plain object for JSON serialization
                    result[k] = {
                        ...v,
                        grid: v.grid.map(row => row.map(cell => {
                            if (cell instanceof Session) {
                                return {
                                    subject: cell.subject,
                                    teacher: cell.teacher,
                                    depts: cell.depts,
                                    sem: cell.sem,
                                    isCombined: cell.isCombined
                                };
                            }
                            return cell;
                        }))
                    };
                });
                res.json({ success: true, timetables: result });
            } else {
                res.status(400).json({ success: false, message: "No valid routine found. Try reducing constraints." });
            }
        } catch (error) {
            console.error(error);
            res.status(500).json({ success: false, message: "Internal server error." });
        }
    });

    // Vite middleware for development
    if (process.env.NODE_ENV !== "production") {
        const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: "spa",
        });
        app.use(vite.middlewares);
    } else {
        const distPath = path.join(process.cwd(), 'dist');
        app.use(express.static(distPath));
        app.get('*', (req, res) => {
            res.sendFile(path.join(distPath, 'index.html'));
        });
    }

    app.listen(PORT, "0.0.0.0", () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

startServer();
