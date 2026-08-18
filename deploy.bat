@echo off
title Auto Deploy - Album Photo Harlan
cls

echo ========================================================
echo        ALBUM PHOTO HARLAN - TU DONG DEPLOY VERCEL
echo ========================================================
echo.
echo [1/3] Kiem tra cac file thay doi...
git status -s
echo.

set commit_msg=
set /p commit_msg="Nhap ghi chu commit (Nhan Enter de dung mac dinh): "
if "%commit_msg%"=="" set commit_msg=Update website

echo.
echo [2/3] Dang them cac file va tao commit...
git add .
git commit -m "%commit_msg%"

echo.
echo [3/3] Dang day code len GitHub (origin main)...
git push origin main

if %ERRORLEVEL% equ 0 (
    echo.
    echo ========================================================
    echo  [THANH CONG] Code da duoc day len GitHub!
    echo  Vercel dang tu dong cap nhat tai:
    echo     https://albumharlan.vercel.app/
    echo ========================================================
) else (
    echo.
    echo ========================================================
    echo  [THAT BAI] Co loi xay ra khi push code len GitHub!
    echo ========================================================
)

echo.
pause
