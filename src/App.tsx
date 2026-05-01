import { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { SplashScreen } from '@/components/common/SplashScreen';
import HomePage from '@/pages/HomePage';
import SetupPage from '@/pages/SetupPage';
import ScoringPage from '@/pages/ScoringPage';
import ScorecardPage from '@/pages/ScorecardPage';
import SummaryPage from '@/pages/SummaryPage';
import HistoryPage from '@/pages/HistoryPage';
import TeamsPage from '@/pages/TeamsPage';
import TeamGenPage from '@/pages/TeamGenPage';

export default function App() {
  const [ready, setReady] = useState(false);

  return (
    <>
      {!ready && <SplashScreen onReady={() => setReady(true)} />}
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/new-match" element={<SetupPage />} />
            <Route path="/match/:matchId/scoring" element={<ScoringPage />} />
            <Route path="/match/:matchId/scorecard" element={<ScorecardPage />} />
            <Route path="/match/:matchId/summary" element={<SummaryPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/teams" element={<TeamsPage />} />
            <Route path="/team-gen" element={<TeamGenPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </>
  );
}
