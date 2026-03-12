import { EventEmitter } from 'events';
export interface Vector3D {
export interface Quaternion {
export interface AudioSourceConfig {
export interface EnvironmentConfig {
export interface MaterialProperties {
    // Web Audio API doesn't support velocity directly, handled by DopplerProcessor
    // Set default forward and up vectors
      // Fallback for older browsers
    // Convert quaternion to forward and up vectors
      // Fallback for older browsers
    // Simplified reflection calculation
    // Dry signal
    // Wet signal through convolution
    // Simplified HRTF loading - in production, load from comprehensive dataset
    // Simplified HRTF generation based on angle
export default {}
