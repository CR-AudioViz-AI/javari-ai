'use client';
type Props = {
  title: string;
  value: string | number;
  severity?: 'normal' | 'critical';
};
export default function SecurityCard({ title, value, severity = 'normal' }: Props) {
  const color =
    severity === 'critical'
      ? 'border-red-500 text-red-600'
      : 'border-gray-200 text-gray-800';
  return (
    <div className={`border rounded-lg p-4 ${color}`}>
      <div className="text-sm font-medium">{title}</div>
      <div className="text-xl font-semibold mt-1">{value}</div>
    </div>
  );
}
