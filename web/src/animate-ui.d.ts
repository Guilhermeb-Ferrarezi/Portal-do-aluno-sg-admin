declare module 'animate-ui' {
  export interface SlidingNumberProps {
    value: number;
    duration?: number;
    className?: string;
    style?: React.CSSProperties;
  }

  export function SlidingNumber(props: SlidingNumberProps): JSX.Element;
}
