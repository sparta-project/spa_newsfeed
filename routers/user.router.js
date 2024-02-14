const express = require('express')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const jwtValidate = require('../middleware/jwt-validate.middleware')
const authenticateToken = require('../middleware/authenticate.middleware')
const dotenv = require('dotenv')

dotenv.config();

const router = express.Router()

// 회원가입 라우터
router.post('/sign-up', async (req, res) => {
    const { email, password, name, age, gender, image } = req.body

    try {
        // 입력 값 유효성 검사
        if (!email || !password || !name) {
            return res
                .status(400)
                .json({ success: false, message: '모든 필드를 입력해주세요.' })
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: '비밀번호는 최소 6자 이상이어야 합니다.',
            })
        }

        // 이메일 중복 검사
        const existingUser = await prisma.user.findUnique({ where: { email } })
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: '이미 사용 중인 이메일입니다.',
            })
        }

        const hashedPassword = await bcrypt.hash(password, 10) // 비밀번호 해싱

        const newUser = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                name,
                age: parseInt(age),
                gender,
                image,
            },
        })

        // JWT 토큰 생성
        const token = jwt.sign(
            { userId: newUser.userId },
            process.env.ACCESS_TOKEN_SECRET,
            { expiresIn: '1d' }
        )
        res.cookie('authorization', `Bearer ${token}`);//포스트 테스트용입니다.
        return res.status(201).json({
            success: true,
            message: '회원가입이 성공적으로 완료되었습니다.',
            token,
        })
    } catch (error) {
        console.error('회원가입 중 에러 발생:', error)
        return res
            .status(500)
            .json({ success: false, message: '서버 에러가 발생했습니다.' })
    }
})

// 로그인 라우터
router.post('/sign-in', async (req, res) => {
    const { email, password } = req.body

    try {
        // 이메일과 비밀번호 유효성 검사
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: '이메일과 비밀번호를 입력해주세요.',
            })
        }

        // 사용자 확인
        const user = await prisma.user.findUnique({ where: { email } })
        if (!user) {
            return res.status(401).json({
                success: false,
                message: '이메일 또는 비밀번호가 잘못되었습니다.',
            })
        }

        // 비밀번호 일치 확인
        const passwordMatch = await bcrypt.compare(password, user.password)
        if (!passwordMatch) {
            return res.status(401).json({
                success: false,
                message: '이메일 또는 비밀번호가 잘못되었습니다.',
            })
        }

        // JWT 토큰 생성
        const accessToken = jwt.sign(
            { userId: user.userId },
            process.env.ACCESS_TOKEN_SECRET,
            { expiresIn: '12h' }
        )
        res.cookie('authorization', `Bearer ${accessToken}`);//포스트 테스트용입니다 삭제 하세요
        return res.json({ success: true, accessToken })
    } catch (error) {
        console.error('로그인 중 에러 발생:', error)
        return res
            .status(500)
            .json({ success: false, message: '서버 에러가 발생했습니다.' })
    }
})

router.get('/me', jwtValidate, (req, res) => {
    const user = res.locals.user

    return res.json({
        email: user.email,
        name: user.name,
        age: user.age,
        gender: user.gender,
        image: user.image,
    })
})

router.patch('/me', jwtValidate, async (req, res) => {
    try {
        const user = res.locals.user
        const userId = user.userId
        const { name, age, gender, image } = req.body
        const updatedUser = await prisma.user.update({
            where: { userId },
            data: {
                name,
                age,
                gender,
                image,
            },
        })

        return res.status(200).json({ success: true, data: updatedUser })
    } catch (error) {
        console.error('내 정보 수정 중 에러 발생:', error)
        return res
            .status(500)
            .json({ success: false, message: '서버 에러가 발생했습니다.' })
    }
})

module.exports = router
