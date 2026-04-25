/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion } from "motion/react";
import { useState, useEffect } from "react";

interface Dept {
  code: string;
  name: string;
  active: boolean;
}

interface Subject {
  id: number;
  name: string;
  credits: number;
  isLab: boolean;
  duration: number;
  dept: string;
  teacherInitials?: string;
}

interface Teacher {
  id: number;
  name: string;
  initials: string;
  dept: string;
}

interface Classroom {
  id: number;
  name: string;
  capacity: number;
  details: string;
}

const generateSlots = (start: string, end: string, lengthStr: string) => {
  // ADBU Specific Schedule
  if (start === "08:00" && lengthStr.startsWith("50")) {
    return [
      "08:00", "08:50", 
      "09:40", // Break 1 (9:40 - 10:00)
      "10:00", "10:50", 
      "11:40", // Break 2 (11:40 - 12:50)
      "12:50", "13:40", "14:30", "15:20", "16:10"
    ];
  }

  const slots = [];
  try {
    let current = new Date(`2024-01-01T${start}:00`);
    const endTime = new Date(`2024-01-01T${end}:00`);
    const length = parseInt(lengthStr.split(" ")[0]);

    if (isNaN(length) || length <= 0) return ["08:30", "09:30", "10:30", "11:30", "12:30", "13:30", "14:30"];

    while (current < endTime) {
      slots.push(current.toTimeString().slice(0, 5));
      current = new Date(current.getTime() + length * 60000);
    }
  } catch (e) {
    return ["08:30", "09:30", "10:30", "11:30", "12:30", "13:30", "14:30"];
  }
  return slots.length > 0 ? slots : ["08:30", "09:30", "10:30", "11:30", "12:30", "13:30", "14:30"];
};

export default function App() {
  const [activeTab, setActiveTab] = useState("Configuration");
  
  // Data State
  const [depts, setDepts] = useState<Dept[]>([
    { code: "CSE", name: "Comp. Science", active: true },
    { code: "EEE", name: "Electrical", active: false },
    { code: "ECE", name: "Electronics", active: false },
  ]);
  
  const [subjects, setSubjects] = useState<Subject[]>([
    { id: 101, name: "Data Structures", credits: 4, isLab: false, duration: 1, dept: "CSE", teacherInitials: "PS" },
    { id: 102, name: "Algorithms", credits: 3, isLab: false, duration: 1, dept: "CSE", teacherInitials: "DV" },
    { id: 103, name: "Operating Systems", credits: 4, isLab: false, duration: 1, dept: "CSE", teacherInitials: "PS" },
  ]);
  
  const [teachers, setTeachers] = useState<Teacher[]>([
    { id: 201, name: "Prof. Sharma", initials: "PS", dept: "CSE" },
    { id: 202, name: "Dr. Verma", initials: "DV", dept: "CSE" },
  ]);

  const [config, setConfig] = useState({
    startTime: "08:00",
    endTime: "16:10",
    slotLength: "50 Minutes"
  });

  const [selectedDept, setSelectedDept] = useState("CSE");
  const [generatedTimetables, setGeneratedTimetables] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    console.log("Starting generation...");
    setIsGenerating(true);
    setError(null);
    
    // Prepare sessions for the backend
    const activeDeptCodes = depts.filter(d => d.active).map(d => d.code);
    const sessions = subjects
      .filter(s => activeDeptCodes.includes(s.dept))
      .map((s) => ({
        name: s.name,
        credits: s.credits,
        isLab: s.isLab,
        duration: s.duration,
        teacherInitials: s.teacherInitials || "TBA",
        depts: [s.dept],
        isCombined: false
      }));

    const slots = generateSlots(config.startTime, config.endTime, config.slotLength);
    let breakIndices: number[] = [];
    
    if (config.startTime === "08:00" && config.slotLength.startsWith("50")) {
      breakIndices = [2, 5]; // 9:40, 11:40
    } else {
      breakIndices = [Math.floor(slots.length / 2)];
    }

    console.log("Payload:", { depts: depts.filter(d => d.active), sessions, slots, breakIndices });

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          depts: depts.filter(d => d.active),
          sessions,
          slots,
          breakIndices
        })
      });

      const data = await response.json();
      console.log("Response:", data);
      if (data.success) {
        setGeneratedTimetables(data.timetables);
        setActiveTab("Result Grid");
      } else {
        setError(data.message || data.error || "Could not generate routine. Try adjusting constraints.");
      }
    } catch (err) {
      console.error("Generation error:", err);
      setError("Failed to connect to the generation engine.");
    } finally {
      setIsGenerating(false);
    }
  };

  const [semesterCycle, setSemesterCycle] = useState("Odd Semester");

  const handleAddDept = (code: string, name: string) => {
    if (code && name) {
      setDepts([...depts, { code, name, active: true }]);
    }
  };

  const handleDeleteDept = (code: string) => {
    setDepts(depts.filter(d => d.code !== code));
  };

  const handleAddItem = (type: string, itemData: any) => {
    if (type === "Subjects") {
      setSubjects([...subjects, { id: Date.now(), ...itemData }]);
    } else if (type === "Teachers") {
      setTeachers([...teachers, { id: Date.now(), ...itemData }]);
    }
  };

  const handleDeleteItem = (type: string, id: number) => {
    if (type === "Subjects") setSubjects(subjects.filter(s => s.id !== id));
    else if (type === "Teachers") setTeachers(teachers.filter(t => t.id !== id));
  };

  const handleSaveConstraints = () => {
    alert("Constraints saved successfully!");
  };

  return (
    <div className="flex min-h-screen bg-bg text-text-primary">
      {/* SideNavBar */}
      <aside className="hidden md:flex h-screen w-[240px] fixed left-0 top-0 pt-10 pb-8 flex-col bg-sidebar-bg border-r border-border z-40">
        <div className="px-6 mb-10">
          <h2 className="text-lg font-extrabold text-white uppercase tracking-wider">ADBU</h2>
          <p className="text-[10px] font-medium tracking-[0.2em] text-accent uppercase">The Academic Atelier</p>
        </div>
        <nav className="flex-1 px-4 space-y-2">
          <NavItem
            icon="settings_suggest"
            label="Configuration"
            active={activeTab === "Configuration"}
            onClick={() => setActiveTab("Configuration")}
          />
          <NavItem
            icon="edit_note"
            label="Data Entry"
            active={activeTab === "Data Entry"}
            onClick={() => setActiveTab("Data Entry")}
          />
          <NavItem
            icon="memory"
            label="Engine Room"
            active={activeTab === "Engine Room"}
            onClick={() => setActiveTab("Engine Room")}
          />
          <NavItem
            icon="grid_view"
            label="Result Grid"
            active={activeTab === "Result Grid"}
            onClick={() => setActiveTab("Result Grid")}
          />
        </nav>
        <div className="mt-auto px-6 space-y-4">
          <div className="text-[10px] text-text-secondary opacity-50 uppercase tracking-widest">V2.0.428_STABLE</div>
          <div className="space-y-1">
            <a className="text-text-secondary hover:text-white flex items-center gap-3 text-xs font-bold uppercase tracking-widest transition-colors" href="#" onClick={(e) => { e.preventDefault(); alert("Help Center coming soon!"); }}>
              <span className="material-symbols-outlined text-lg">help</span>
              <span>Help Center</span>
            </a>
            <a className="text-text-secondary hover:text-red-500 flex items-center gap-3 text-xs font-bold uppercase tracking-widest transition-colors" href="#" onClick={(e) => { e.preventDefault(); alert("Logging out..."); }}>
              <span className="material-symbols-outlined text-lg">logout</span>
              <span>Log Out</span>
            </a>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col md:ml-[240px] transition-all duration-300">
        {/* TopNavBar */}
        <header className="fixed top-0 right-0 left-0 md:left-[240px] z-50 bg-bg/80 backdrop-blur-xl h-16 flex justify-between items-center px-10 border-b border-border">
          <div className="flex items-center gap-6">
            <div className="hidden sm:flex items-center bg-card-bg border border-border rounded-full px-4 py-1.5 gap-2 w-[300px]">
              <span className="material-symbols-outlined text-text-secondary text-sm">search</span>
              <input className="bg-transparent border-none text-xs focus:ring-0 text-text-secondary w-full outline-none" placeholder="Search configurations..." type="text" />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 text-right">
              <div className="hidden sm:block">
                <div className="text-xs font-bold text-white">Law reang</div>
                <div className="text-[10px] text-text-secondary uppercase tracking-wider">Admin Access</div>
              </div>
              <div className="w-8 h-8 rounded-full bg-slate-700 overflow-hidden border border-accent">
                <img
                  alt="Current User Avatar"
                  className="w-full h-full object-cover"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuDTrgX9LcZzTULZd3hsoZWsekR1SHAkZBwzQHXADLHrDY--VYaHKnRte_uMnnowgRjAdB_YP3l9WyAyT9tip2I6nBpG8XqSNmUUp5XSdoY3n4j_dHSiIbquHTaypbmRSr67dz7kjwbeQC1xHhUk5Qsggac9UIOticzCl1meYEVcnpzmKMj_EaJ-J_n8CCXfHtqZRYu1FAlTJiWCoKmB3SQFB3PuAZHamkcwm2VrW7924Ct3Hh0E3qEad2vCWSeuZSUJ6quelBzLpw"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>
          </div>
        </header>

        {/* Canvas */}
        <div className="pt-24 px-10 pb-12 max-w-7xl mx-auto w-full">
          {activeTab === "Configuration" && (
            <ConfigurationPage 
              depts={depts} 
              setDepts={setDepts} 
              config={config} 
              setConfig={setConfig} 
              handleAddDept={handleAddDept}
              handleDeleteDept={handleDeleteDept}
              handleSaveConstraints={handleSaveConstraints}
              semesterCycle={semesterCycle}
              setSemesterCycle={setSemesterCycle}
            />
          )}
          {activeTab === "Data Entry" && (
            <DataEntryPage 
              subjects={subjects} 
              teachers={teachers} 
              depts={depts}
              selectedDept={selectedDept}
              setSelectedDept={setSelectedDept}
              handleAddItem={handleAddItem} 
              handleDeleteItem={handleDeleteItem} 
            />
          )}
          {activeTab === "Engine Room" && (
            <EngineRoomPage 
              isGenerating={isGenerating} 
              handleGenerate={handleGenerate} 
              depts={depts}
              error={error}
            />
          )}
          {activeTab === "Result Grid" && (
            <ResultGridPage 
              timetables={generatedTimetables} 
              config={config}
            />
          )}

          <footer className="mt-20 pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-[10px] font-bold text-text-secondary uppercase tracking-[0.2em]">
              © 2026 ADBU — The Academic Atelier
            </div>
            <div className="text-[10px] font-bold text-accent uppercase tracking-[0.2em]">
              All rights reserved to Byte_Fang_ADBU
            </div>
          </footer>
        </div>
      </main>

      {/* Mobile Navigation (Bottom) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-sidebar-bg flex justify-around items-center px-4 border-t border-border z-50">
        <MobileNavItem icon="settings_suggest" label="Setup" active={activeTab === "Configuration"} onClick={() => setActiveTab("Configuration")} />
        <MobileNavItem icon="edit_note" label="Data" active={activeTab === "Data Entry"} onClick={() => setActiveTab("Data Entry")} />
        <MobileNavItem icon="memory" label="Engine" active={activeTab === "Engine Room"} onClick={() => setActiveTab("Engine Room")} />
        <MobileNavItem icon="grid_view" label="Grid" active={activeTab === "Result Grid"} onClick={() => setActiveTab("Result Grid")} />
      </nav>
    </div>
  );
}

interface ConfigurationPageProps {
  depts: Dept[];
  setDepts: React.Dispatch<React.SetStateAction<Dept[]>>;
  config: any;
  setConfig: any;
  handleAddDept: (code: string, name: string) => void;
  handleDeleteDept: (code: string) => void;
  handleSaveConstraints: () => void;
  semesterCycle: string;
  setSemesterCycle: React.Dispatch<React.SetStateAction<string>>;
}

function ConfigurationPage({ depts, setDepts, config, setConfig, handleAddDept, handleDeleteDept, handleSaveConstraints, semesterCycle, setSemesterCycle }: ConfigurationPageProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newDept, setNewDept] = useState({ code: "", name: "" });

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col mb-10"
      >
        <h1 className="text-4xl font-extrabold text-white tracking-tight mb-2">Step 1: Configuration</h1>
        <p className="text-text-secondary text-sm max-w-2xl">Initialize the fundamental parameters for the routine generation engine.</p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="lg:col-span-2 bg-card-bg border border-border rounded-2xl p-6 relative overflow-hidden"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-base font-bold text-white">Departmental Nodes</h3>
            {!isAdding && (
              <button 
                onClick={() => setIsAdding(true)}
                className="text-accent font-bold text-[11px] hover:underline cursor-pointer uppercase tracking-wider"
              >
                + ADD DEPT
              </button>
            )}
          </div>

          {isAdding && (
            <div className="mb-6 p-4 bg-bg border border-accent/30 rounded-xl flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-[120px]">
                <label className="text-[10px] font-bold text-text-secondary uppercase mb-2 block">Code</label>
                <input 
                  value={newDept.code}
                  onChange={(e) => setNewDept({ ...newDept, code: e.target.value.toUpperCase() })}
                  className="w-full bg-card-bg border border-border rounded-lg p-2 text-sm text-white focus:border-accent outline-none"
                  placeholder="e.g. ME"
                />
              </div>
              <div className="flex-[2] min-w-[200px]">
                <label className="text-[10px] font-bold text-text-secondary uppercase mb-2 block">Name</label>
                <input 
                  value={newDept.name}
                  onChange={(e) => setNewDept({ ...newDept, name: e.target.value })}
                  className="w-full bg-card-bg border border-border rounded-lg p-2 text-sm text-white focus:border-accent outline-none"
                  placeholder="e.g. Mechanical"
                />
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => {
                    handleAddDept(newDept.code, newDept.name);
                    setNewDept({ code: "", name: "" });
                    setIsAdding(false);
                  }}
                  className="px-4 py-2 bg-accent text-white rounded-lg text-[10px] font-bold uppercase tracking-widest"
                >
                  Save
                </button>
                <button 
                  onClick={() => setIsAdding(false)}
                  className="px-4 py-2 bg-border text-text-secondary rounded-lg text-[10px] font-bold uppercase tracking-widest"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {depts.map((d) => (
              <DeptCard 
                key={d.code} 
                code={d.code} 
                name={d.name} 
                active={d.active} 
                onClick={() => setDepts(depts.map((dept) => dept.code === d.code ? { ...dept, active: !dept.active } : dept))}
                onDelete={(e) => {
                  e.stopPropagation();
                  handleDeleteDept(d.code);
                }}
              />
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="lg:col-span-1 bg-card-bg border border-border rounded-2xl p-6"
        >
          <h3 className="text-base font-bold text-white mb-6">Semester Cycle</h3>
          <div className="space-y-3">
            <CycleOption 
              label="Odd Semester" 
              date="Jul — Dec 2026" 
              active={semesterCycle === "Odd Semester"} 
              onClick={() => setSemesterCycle("Odd Semester")}
            />
            <CycleOption 
              label="Even Semester" 
              date="Jan — Jun 2027" 
              active={semesterCycle === "Even Semester"} 
              onClick={() => setSemesterCycle("Even Semester")}
            />
            <CycleOption 
              label="Manual Set" 
              date="Custom Range" 
              active={semesterCycle === "Manual Set"} 
              onClick={() => setSemesterCycle("Manual Set")}
            />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="lg:col-span-3 bg-card-bg border border-border rounded-2xl p-6"
        >
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
            <GridInput label="Start Time" type="time" value={config.startTime} onChange={(e: any) => setConfig({ ...config, startTime: e.target.value })} />
            <GridInput label="End Time" type="time" value={config.endTime} onChange={(e: any) => setConfig({ ...config, endTime: e.target.value })} />
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold tracking-widest text-text-secondary uppercase">
                Slot Length
              </label>
              <select 
                value={config.slotLength} 
                onChange={(e: any) => setConfig({ ...config, slotLength: e.target.value })}
                className="bg-bg border border-border rounded-lg p-3 text-sm font-bold text-white focus:border-accent outline-none"
              >
                <option>50 Minutes</option>
                <option>60 Minutes</option>
                <option>90 Minutes</option>
              </select>
            </div>
            <div className="flex justify-end">
              <button 
                onClick={handleSaveConstraints}
                className="w-full md:w-auto px-8 py-3 bg-accent text-white rounded-lg font-bold text-xs uppercase tracking-widest hover:brightness-110 transition-all cursor-pointer"
              >
                Save Constraints
              </button>
            </div>
          </div>

          <div className="mt-10">
            <h4 className="text-[10px] font-bold text-text-secondary tracking-widest uppercase mb-4">Grid Visualization</h4>
            <div className="h-10 bg-border rounded-lg flex overflow-hidden">
              <div className="flex-1 border-r border-bg bg-accent/10 flex items-center justify-center text-[10px] font-bold text-text-secondary">{config.startTime}</div>
              {generateSlots(config.startTime, config.endTime, config.slotLength).slice(1, -1).map((slot, i) => {
                const isBreak = (config.startTime === "08:00" && config.slotLength.startsWith("50") && [2, 5].includes(i + 1));
                return (
                  <div 
                    key={i} 
                    className={`flex-1 border-r border-bg flex items-center justify-center text-[10px] font-bold uppercase ${
                      isBreak ? "bg-red-500/20 text-red-400" : "bg-accent/10 text-text-secondary"
                    }`}
                  >
                    {isBreak ? "Break" : `Slot ${i + 1}`}
                  </div>
                );
              })}
              <div className="flex-1 bg-accent/10 flex items-center justify-center text-[10px] font-bold text-text-secondary">{config.endTime}</div>
            </div>
          </div>
        </motion.div>
      </div>
    </>
  );
}

function DataEntryPage({ subjects, teachers, depts, selectedDept, setSelectedDept, handleAddItem, handleDeleteItem }: any) {
  const [activeSubTab, setActiveSubTab] = useState("Subjects");
  const [isAdding, setIsAdding] = useState(false);
  const [newItem, setNewItem] = useState<any>({});

  const data = activeSubTab === "Subjects" 
    ? subjects.filter((s: any) => s.dept === selectedDept)
    : teachers.filter((t: any) => t.dept === selectedDept);

  useEffect(() => {
    setIsAdding(false);
    if (activeSubTab === "Subjects") {
      setNewItem({ dept: selectedDept, isLab: false, duration: 1 });
    } else if (activeSubTab === "Teachers") {
      setNewItem({ dept: selectedDept });
    } else {
      setNewItem({ details: "General Classroom" });
    }
  }, [activeSubTab, selectedDept]);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col mb-10"
      >
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div>
            <h1 className="text-4xl font-extrabold text-white tracking-tight mb-2">Step 2: Data Entry</h1>
            <p className="text-text-secondary text-sm max-w-2xl">Manage your academic inventory for the selected department.</p>
          </div>
          
          {(activeSubTab === "Subjects" || activeSubTab === "Teachers") && (
            <div className="flex flex-col gap-2 w-full md:w-auto">
              <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Active Department</label>
              <select 
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="bg-card-bg border border-border rounded-xl px-4 py-2.5 text-xs font-bold text-white outline-none focus:border-accent min-w-[200px]"
              >
                {depts.map((d: any) => (
                  <option key={d.code} value={d.code}>{d.name} ({d.code})</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </motion.div>

      <div className="flex gap-4 mb-8 border-b border-border">
        {["Subjects", "Teachers"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveSubTab(tab)}
            className={`pb-4 px-2 text-sm font-bold uppercase tracking-widest transition-all cursor-pointer ${
              activeSubTab === tab ? "text-accent border-b-2 border-accent" : "text-text-secondary hover:text-white"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <motion.div
        key={activeSubTab}
        initial={{ opacity: 0, x: 10 }}
        animate={{ opacity: 1, x: 0 }}
        className="bg-card-bg border border-border rounded-2xl p-6"
      >
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-bold text-white">{activeSubTab} Inventory</h3>
          {!isAdding && (
            <button 
              onClick={() => setIsAdding(true)}
              className="px-4 py-2 bg-accent/10 text-accent border border-accent/20 rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-accent hover:text-white transition-all cursor-pointer"
            >
              + Add New {activeSubTab.slice(0, -1)}
            </button>
          )}
        </div>

        {isAdding && (
          <div className="mb-8 p-6 bg-bg border border-accent/30 rounded-xl grid grid-cols-1 sm:grid-cols-3 gap-6 items-end">
            {activeSubTab === "Subjects" && (
              <>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-bold text-text-secondary uppercase">Department</label>
                  <select 
                    className="bg-card-bg border border-border rounded-lg p-2 text-sm text-white outline-none focus:border-accent"
                    value={newItem.dept || selectedDept}
                    onChange={(e) => setNewItem({ ...newItem, dept: e.target.value })}
                  >
                    {depts.map((d: Dept) => (
                      <option key={d.code} value={d.code}>{d.code}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-bold text-text-secondary uppercase">Subject Name</label>
                  <input 
                    className="bg-card-bg border border-border rounded-lg p-2 text-sm text-white outline-none focus:border-accent"
                    placeholder="e.g. Physics"
                    value={newItem.name || ""}
                    onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-bold text-text-secondary uppercase">Credits</label>
                  <input 
                    type="number"
                    className="bg-card-bg border border-border rounded-lg p-2 text-sm text-white outline-none focus:border-accent"
                    placeholder="e.g. 4"
                    value={newItem.credits || ""}
                    onChange={(e) => setNewItem({ ...newItem, credits: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-bold text-text-secondary uppercase">Type</label>
                  <select 
                    className="bg-card-bg border border-border rounded-lg p-2 text-sm text-white outline-none focus:border-accent"
                    value={newItem.isLab ? "Lab" : "Theory"}
                    onChange={(e) => setNewItem({ ...newItem, isLab: e.target.value === "Lab", duration: e.target.value === "Lab" ? 2 : 1 })}
                  >
                    <option value="Theory">Theory</option>
                    <option value="Lab">Lab</option>
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-bold text-text-secondary uppercase">Professor Initials</label>
                  <input 
                    className="bg-card-bg border border-border rounded-lg p-2 text-sm text-white outline-none focus:border-accent"
                    placeholder="e.g. PS"
                    value={newItem.teacherInitials || ""}
                    onChange={(e) => setNewItem({ ...newItem, teacherInitials: e.target.value.toUpperCase() })}
                  />
                </div>
              </>
            )}
            {activeSubTab === "Teachers" && (
              <>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-bold text-text-secondary uppercase">Department</label>
                  <select 
                    className="bg-card-bg border border-border rounded-lg p-2 text-sm text-white outline-none focus:border-accent"
                    value={newItem.dept || selectedDept}
                    onChange={(e) => setNewItem({ ...newItem, dept: e.target.value })}
                  >
                    {depts.map((d: Dept) => (
                      <option key={d.code} value={d.code}>{d.code}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-bold text-text-secondary uppercase">Teacher Name</label>
                  <input 
                    className="bg-card-bg border border-border rounded-lg p-2 text-sm text-white outline-none focus:border-accent"
                    placeholder="e.g. Dr. Smith"
                    value={newItem.name || ""}
                    onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-bold text-text-secondary uppercase">Initials</label>
                  <input 
                    className="bg-card-bg border border-border rounded-lg p-2 text-sm text-white outline-none focus:border-accent"
                    placeholder="e.g. DS"
                    value={newItem.initials || ""}
                    onChange={(e) => setNewItem({ ...newItem, initials: e.target.value.toUpperCase() })}
                  />
                </div>
              </>
            )}
            {activeSubTab === "Classrooms" && (
              <>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-bold text-text-secondary uppercase">Room Name</label>
                  <input 
                    className="bg-card-bg border border-border rounded-lg p-2 text-sm text-white outline-none focus:border-accent"
                    placeholder="e.g. R-101"
                    value={newItem.name || ""}
                    onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-bold text-text-secondary uppercase">Capacity</label>
                  <input 
                    type="number"
                    className="bg-card-bg border border-border rounded-lg p-2 text-sm text-white outline-none focus:border-accent"
                    placeholder="e.g. 60"
                    value={newItem.capacity || ""}
                    onChange={(e) => setNewItem({ ...newItem, capacity: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </>
            )}
            <div className="sm:col-span-3 flex justify-end gap-3">
              <button 
                onClick={() => {
                  if (!newItem.name) {
                    alert("Please enter a name.");
                    return;
                  }
                  handleAddItem(activeSubTab, newItem);
                  setIsAdding(false);
                  // Reset newItem based on current tab
                  if (activeSubTab === "Subjects") {
                    setNewItem({ dept: selectedDept, isLab: false, duration: 1 });
                  } else if (activeSubTab === "Teachers") {
                    setNewItem({ dept: selectedDept });
                  } else {
                    setNewItem({ details: "General Classroom" });
                  }
                }}
                className="px-6 py-2 bg-accent text-white rounded-lg text-xs font-bold uppercase tracking-widest"
              >
                Add to Inventory
              </button>
              <button 
                onClick={() => setIsAdding(false)}
                className="px-6 py-2 bg-border text-text-secondary rounded-lg text-xs font-bold uppercase tracking-widest"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="py-4 px-4 text-[10px] font-bold text-text-secondary uppercase tracking-widest">ID</th>
                <th className="py-4 px-4 text-[10px] font-bold text-text-secondary uppercase tracking-widest">Name</th>
                <th className="py-4 px-4 text-[10px] font-bold text-text-secondary uppercase tracking-widest">Details</th>
                <th className="py-4 px-4 text-[10px] font-bold text-text-secondary uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item: any) => (
                <tr key={item.id} className="border-b border-border/50 hover:bg-white/5 transition-colors">
                  <td className="py-4 px-4 text-sm font-mono text-accent">#{item.id}</td>
                  <td className="py-4 px-4 text-sm font-bold text-white">
                    {item.name} {item.initials && `(${item.initials})`}
                  </td>
                  <td className="py-4 px-4 text-xs text-text-secondary">
                    {activeSubTab === "Subjects" && (
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <span className={`px-1.5 py-0.5 rounded-[4px] text-[8px] font-bold uppercase ${item.isLab ? "bg-purple-500/20 text-purple-400" : "bg-blue-500/20 text-blue-400"}`}>
                            {item.isLab ? "Lab" : "Theory"}
                          </span>
                          <span>{item.credits} Credits • {item.duration} {item.duration === 1 ? "Slot" : "Slots"}</span>
                        </div>
                        <div className="opacity-60">{item.teacherInitials || "No Prof"} • {item.room || "No Room"}</div>
                      </div>
                    )}
                    {activeSubTab === "Teachers" && `Faculty • ${item.dept} Dept`}
                    {activeSubTab === "Classrooms" && `Capacity: ${item.capacity} • ${item.details}`}
                  </td>
                  <td className="py-4 px-4 text-right">
                    <button 
                      onClick={() => alert("Edit functionality coming soon!")}
                      className="p-2 text-text-secondary hover:text-white transition-colors"
                    >
                      <span className="material-symbols-outlined text-lg">edit</span>
                    </button>
                    <button 
                      onClick={() => handleDeleteItem(activeSubTab, item.id)}
                      className="p-2 text-text-secondary hover:text-red-500 transition-colors"
                    >
                      <span className="material-symbols-outlined text-lg">delete</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </>
  );
}

function EngineRoomPage({ isGenerating, handleGenerate, depts, error }: any) {
  const activeDepts = depts.filter((d: any) => d.active);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col mb-10"
      >
        <h1 className="text-4xl font-extrabold text-white tracking-tight mb-2">Step 3: Engine Room</h1>
        <p className="text-text-secondary text-sm max-w-2xl">Execute the generation algorithm and monitor constraint satisfaction.</p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="lg:col-span-2 bg-card-bg border border-border rounded-2xl p-8 flex flex-col items-center justify-center text-center"
        >
          <div className={`w-24 h-24 rounded-full border-4 flex items-center justify-center mb-6 transition-all duration-1000 ${
            isGenerating ? "border-accent border-t-transparent animate-spin" : "border-border"
          }`}>
            <span className={`material-symbols-outlined text-4xl ${isGenerating ? "text-accent" : "text-text-secondary"}`}>
              {isGenerating ? "autorenew" : "memory"}
            </span>
          </div>
          <h3 className="text-2xl font-bold text-white mb-2">
            {isGenerating ? "Processing Grid..." : "Ready to Generate"}
          </h3>
          <p className="text-text-secondary text-sm mb-8 max-w-md">
            The backtracking engine will attempt to find a clash-free routine for {activeDepts.length} active departments.
          </p>
          
          <button 
            onClick={handleGenerate}
            disabled={isGenerating || activeDepts.length === 0}
            className={`px-10 py-4 rounded-xl font-bold uppercase tracking-widest transition-all ${
              isGenerating || activeDepts.length === 0
                ? "bg-border text-text-secondary cursor-not-allowed" 
                : "bg-accent text-white hover:shadow-[0_0_30px_rgba(59,130,246,0.3)] cursor-pointer"
            }`}
          >
            {isGenerating ? "Generating..." : "Start Generation"}
          </button>

          {error && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs flex items-center gap-3"
            >
              <span className="material-symbols-outlined text-sm">error</span>
              {error}
            </motion.div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="lg:col-span-1 bg-card-bg border border-border rounded-2xl p-6"
        >
          <h3 className="text-base font-bold text-white mb-6">Active Scope</h3>
          <div className="space-y-4">
            {activeDepts.map((d: any) => (
              <div key={d.code} className="flex items-center justify-between p-3 bg-bg border border-border rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-accent"></div>
                  <span className="text-xs font-bold text-white">{d.code}</span>
                </div>
                <span className="text-[10px] text-text-secondary uppercase tracking-wider">{d.name}</span>
              </div>
            ))}
            {activeDepts.length === 0 && (
              <div className="text-center py-10">
                <p className="text-xs text-text-secondary italic">No departments selected for generation.</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </>
  );
}

function ConstraintItem({ label, status }: { label: string; status: "Passed" | "Warning" | "Failed" }) {
  return (
    <div className="flex items-center justify-between p-3 bg-bg rounded-lg border border-border/50">
      <span className="text-sm font-medium text-white">{label}</span>
      <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded ${
        status === "Passed" ? "bg-green-500/10 text-green-500" : "bg-yellow-500/10 text-yellow-500"
      }`}>
        {status}
      </span>
    </div>
  );
}

function ResultGridPage({ timetables, config }: any) {
  const [viewMode, setViewMode] = useState("Single"); // "Single" or "Full"
  const [selectedKey, setSelectedKey] = useState("");
  
  const days = ["Day 1", "Day 2", "Day 3", "Day 4", "Day 5"];
  const slots = generateSlots(config.startTime, config.endTime, config.slotLength);

  useEffect(() => {
    if (timetables && Object.keys(timetables).length > 0) {
      setSelectedKey(Object.keys(timetables)[0]);
    }
  }, [timetables]);

  const isBreakSlot = (index: number) => {
    return config.startTime === "08:00" && config.slotLength.startsWith("50") && [2, 5].includes(index);
  };

  if (!timetables) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <span className="material-symbols-outlined text-6xl text-text-secondary mb-4">grid_off</span>
        <h2 className="text-2xl font-bold text-white mb-2">No Results Yet</h2>
        <p className="text-text-secondary text-sm">Go to the Engine Room to generate your first routine.</p>
      </div>
    );
  }

  const renderTable = (tt: any, key: string) => (
    <div key={key} className="mb-12">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-2 h-6 bg-accent rounded-full"></div>
        <h3 className="text-lg font-bold text-white uppercase tracking-wider">{tt.dept} — Semester {tt.sem}</h3>
      </div>
      <div className="bg-card-bg border border-border rounded-2xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="p-4 bg-bg border-r border-b border-border text-[10px] font-bold text-text-secondary uppercase tracking-widest w-32">Time / Day</th>
                {days.map(day => (
                  <th key={day} className="p-4 bg-bg border-b border-border text-[10px] font-bold text-text-secondary uppercase tracking-widest min-w-[150px]">
                    {day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {slots.map((time, slotIdx) => (
                <tr key={time}>
                  <td className="p-4 bg-bg border-r border-b border-border text-xs font-bold text-accent text-center">{time}</td>
                  {days.map((day, dayIdx) => {
                    const cell = tt.grid[dayIdx][slotIdx];
                    return (
                      <td key={`${day}-${time}`} className="p-2 border-b border-border/50">
                        {cell === "BREAK" ? (
                          <div className="h-full bg-red-500/10 border border-red-500/20 rounded-lg flex items-center justify-center py-4">
                            <span className="text-[10px] font-bold text-red-500 uppercase tracking-[0.2em]">Break</span>
                          </div>
                        ) : cell ? (
                          <div className={`p-3 bg-bg border border-border rounded-lg hover:border-accent transition-all cursor-pointer group relative overflow-hidden ${cell.subject.isLab ? "border-l-4 border-l-purple-500" : "border-l-4 border-l-blue-500"}`}>
                            <div className="text-[10px] font-bold text-white mb-1 group-hover:text-accent truncate">{cell.subject.name}</div>
                            <div className="text-[8px] text-text-secondary uppercase tracking-wider flex items-center gap-2">
                              <span className="font-bold text-accent">{cell.teacher.initials}</span>
                              {cell.subject.isLab && (
                                <span className="ml-auto text-[7px] bg-purple-500/10 text-purple-400 px-1 rounded">{cell.subject.duration}-SLOT</span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="h-full min-h-[60px] border border-dashed border-border/30 rounded-lg" />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col mb-10"
      >
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div>
            <h1 className="text-4xl font-extrabold text-white tracking-tight mb-2">Step 4: Result Grid</h1>
            <p className="text-text-secondary text-sm max-w-2xl">
              {viewMode === "Full" ? "Comprehensive temporal matrix for all departments." : `Finalized temporal matrix for ${timetables[selectedKey]?.dept} (Semester ${timetables[selectedKey]?.sem}).`}
            </p>
          </div>
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="flex bg-card-bg border border-border rounded-xl p-1">
              <button 
                onClick={() => setViewMode("Single")}
                className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${viewMode === "Single" ? "bg-accent text-white" : "text-text-secondary hover:text-white"}`}
              >
                Single
              </button>
              <button 
                onClick={() => setViewMode("Full")}
                className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${viewMode === "Full" ? "bg-accent text-white" : "text-text-secondary hover:text-white"}`}
              >
                Full View
              </button>
            </div>
            
            {viewMode === "Single" && (
              <select 
                value={selectedKey}
                onChange={(e) => setSelectedKey(e.target.value)}
                className="bg-card-bg border border-border rounded-xl px-4 py-2 text-xs font-bold text-white outline-none focus:border-accent"
              >
                {Object.keys(timetables).map(key => (
                  <option key={key} value={key}>{timetables[key].dept} (Sem {timetables[key].sem})</option>
                ))}
              </select>
            )}

            <div className="flex gap-2">
              <button className="p-2.5 bg-card-bg border border-border rounded-xl text-white hover:bg-white/5 transition-all cursor-pointer">
                <span className="material-symbols-outlined text-lg">download</span>
              </button>
              <button className="p-2.5 bg-card-bg border border-border rounded-xl text-white hover:bg-white/5 transition-all cursor-pointer">
                <span className="material-symbols-outlined text-lg">print</span>
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {viewMode === "Full" ? (
        Object.entries(timetables).map(([key, tt]) => renderTable(tt, key))
      ) : (
        selectedKey && renderTable(timetables[selectedKey], selectedKey)
      )}
    </>
  );
}

interface NavItemProps {
  icon: string;
  label: string;
  active: boolean;
  onClick: () => void;
}

function NavItem({ icon, label, active, onClick }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
        active
          ? "bg-accent text-white"
          : "text-text-secondary hover:bg-white/5"
      }`}
    >
      <span className="material-symbols-outlined text-lg">{icon}</span>
      <span className="font-body text-[13px] font-medium tracking-wide uppercase">{label}</span>
    </button>
  );
}

interface DeptCardProps {
  code: string;
  name: string;
  active?: boolean;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
}

function DeptCard({ code, name, active = false, onClick, onDelete }: DeptCardProps) {
  return (
    <div 
      onClick={onClick}
      className={`bg-bg border rounded-xl p-4 text-center transition-all duration-200 cursor-pointer relative group ${
      active ? "border-accent bg-accent/5" : "border-border hover:border-accent/50"
    }`}>
      <button 
        onClick={onDelete}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 text-text-secondary hover:text-red-500 transition-all"
      >
        <span className="material-symbols-outlined text-sm">close</span>
      </button>
      <div className={`font-bold text-lg mb-1 ${active ? "text-accent" : "text-white"}`}>{code}</div>
      <div className="text-[10px] text-text-secondary uppercase tracking-wider">{name}</div>
    </div>
  );
}

function CycleOption({ label, date, active = false, onClick }: { label: string; date: string; active?: boolean; onClick?: () => void }) {
  return (
    <label 
      onClick={onClick}
      className={`flex items-center gap-4 p-4 bg-bg border rounded-xl cursor-pointer transition-all ${
      active ? "border-accent" : "border-border hover:border-accent/30"
    }`}>
      <div className={`w-3 h-3 border-2 rounded-full flex items-center justify-center ${
        active ? "border-accent bg-accent" : "border-border"
      }`}>
        {active && <div className="w-1 h-1 bg-white rounded-full" />}
      </div>
      <div className="flex flex-col">
        <span className="text-[13px] font-bold text-white">{label}</span>
        <span className="text-[10px] text-text-secondary">{date}</span>
      </div>
    </label>
  );
}

function GridInput({ label, type, value, onChange }: { label: string; type: string; value: string; onChange: (e: any) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-[10px] font-bold tracking-widest text-text-secondary uppercase">
        {label}
      </label>
      <input
        className="bg-bg border border-border rounded-lg p-3 text-sm font-bold text-white focus:border-accent outline-none"
        type={type}
        value={value}
        onChange={onChange}
      />
    </div>
  );
}

function MobileNavItem({ icon, label, active, onClick }: { icon: string; label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center gap-1 ${active ? "text-accent" : "text-text-secondary"}`}>
      <span className="material-symbols-outlined">{icon}</span>
      <span className={`text-[10px] ${active ? "font-bold" : "font-medium"}`}>{label}</span>
    </button>
  );
}

