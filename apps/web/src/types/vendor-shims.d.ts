declare module 'axios' {
  const axios: any;
  export default axios;
}

declare module 'framer-motion' {
  export const motion: any;
  export const AnimatePresence: any;
  export const useInView: any;
  export const useAnimation: any;
  export const useScroll: any;
  export const useTransform: any;
  export const useMotionTemplate: any;
  export const useMotionValue: any;
  export const useReducedMotion: any;
}

declare module 'react-hook-form' {
  export function useForm<T = any>(options?: any): any;
  export const Controller: any;
  export type SubmitHandler<T = any> = (data: T) => void;
}

declare module '@hookform/resolvers/zod' {
  export const zodResolver: any;
}
