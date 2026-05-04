import React from 'react';
import { Trophy } from 'lucide-react';
import { TargetsLeaderboard } from '@/components/targets/TargetsLeaderboard';

const TargetsLeaderboardPage: React.FC = () => {
  return (
    <div className="p-4 space-y-4" dir="rtl">
      <div className="flex items-center gap-2">
        <Trophy className="w-6 h-6 text-primary" />
        <h2 className="text-xl font-bold">لوحة أداء العمال</h2>
      </div>
      <TargetsLeaderboard />
    </div>
  );
};

export default TargetsLeaderboardPage;