import { Plus, Search } from 'lucide-react';
import { useState } from 'react';

import { useReports } from '../state/report-context';
import { Button } from './ui/button';

const patients = [
  { id: 'P-00142', name: 'Ananya Sharma', sex: 'Female', age: '42 years', mobile: '98XXXXXX41', lastReport: '14 Feb 2026' },
  { id: 'P-00143', name: 'Rohan Mehta', sex: 'Male', age: '36 years', mobile: '97XXXXXX18', lastReport: '18 Feb 2026' },
  { id: 'P-00117', name: 'Meera Nair', sex: 'Female', age: '57 years', mobile: '99XXXXXX63', lastReport: '04 Feb 2026' },
];

export function Patients() {
  const { startNew } = useReports();
  const [query, setQuery] = useState('');
  const visible = patients.filter(patient => `${patient.id} ${patient.name} ${patient.mobile}`.toLowerCase().includes(query.toLowerCase()));
  return <section className="page-grid"><header className="pane-titlebar"><div className="flex items-baseline gap-2"><h1>Patients</h1><span>Search and reuse existing patient records</span></div><Button onClick={startNew} variant="default"><Plus />New patient / report</Button></header><div className="patients-page"><label className="search-field"><Search /><input aria-label="Search patients" onChange={event => setQuery(event.target.value)} placeholder="Search by name, mobile, or patient ID" value={query} /></label><table className="worklist-table"><thead><tr><th>Patient ID</th><th>Name</th><th>Sex</th><th>Age</th><th>Mobile</th><th>Last report</th></tr></thead><tbody>{visible.map(patient => <tr key={patient.id} onDoubleClick={startNew}><td>{patient.id}</td><td><strong>{patient.name}</strong></td><td>{patient.sex}</td><td>{patient.age}</td><td>{patient.mobile}</td><td>{patient.lastReport}</td></tr>)}</tbody></table></div></section>;
}
