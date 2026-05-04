import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Target, Trophy, ListChecks } from 'lucide-react';
import { TargetsList } from '@/components/targets/TargetsList';
import { TargetsLeaderboard } from '@/components/targets/TargetsLeaderboard';

const Targets: React.FC = () => {
  const [tab, setTab] = useState('leaderboard');

  return (
    <div className="p-4 space-y-4" dir="rtl">
      <div className="flex items-center gap-2">
        <Target className="w-6 h-6 text-primary" />
        <h2 className="text-xl font-bold">أهداف العمال والحوافز</h2>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid grid-cols-2 w-full max-w-md">
          <TabsTrigger value="leaderboard" className="gap-2">
            <Trophy className="w-4 h-4" /> لوحة الأداء
          </TabsTrigger>
          <TabsTrigger value="list" className="gap-2">
            <ListChecks className="w-4 h-4" /> إدارة الأهداف
          </TabsTrigger>
        </TabsList>

        <TabsContent value="leaderboard" className="mt-4">
          <TargetsLeaderboard />
        </TabsContent>

        <TabsContent value="list" className="mt-4">
          <TargetsList />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Targets;
