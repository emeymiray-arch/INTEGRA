import { Outlet } from 'react-router-dom';
import { motion } from 'framer-motion';
import { pageTransition } from '@/shared/lib/motion';

export function AuthLayout() {
  return (
    <div className="flex min-h-screen">
      <div className="hidden w-1/2 flex-col justify-between bg-primary p-12 text-white lg:flex">
        <div>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary/30 text-xl font-bold">
            I
          </div>
          <h1 className="mt-8 text-4xl font-bold tracking-tight">INTEGRA</h1>
          <p className="mt-3 text-lg text-white/70">Целостный подход к здоровью</p>
        </div>
        <p className="text-sm text-white/50">
          Профессиональная CRM для медицинских центров остеопатии, мануальной терапии и
          реабилитации.
        </p>
      </div>
      <div className="flex flex-1 items-center justify-center bg-background p-6">
        <motion.div className="w-full max-w-md" {...pageTransition}>
          <Outlet />
        </motion.div>
      </div>
    </div>
  );
}
