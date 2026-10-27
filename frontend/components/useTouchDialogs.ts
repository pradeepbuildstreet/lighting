"use client";
import {useEffect,useState} from 'react';
export const TOUCH_DIALOG_QUERY='(max-width:1023px), (hover: none), (pointer: coarse)';
export function useTouchDialogs(){const [touch,setTouch]=useState(false);useEffect(()=>{const media=window.matchMedia(TOUCH_DIALOG_QUERY),update=()=>setTouch(media.matches);update();media.addEventListener('change',update);return()=>media.removeEventListener('change',update);},[]);return touch;}
