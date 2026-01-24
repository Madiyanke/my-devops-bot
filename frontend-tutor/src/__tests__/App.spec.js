import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import App from '../App.vue'

describe('App.vue', () => {
    it('renders the chat interface', () => {
        const wrapper = mount(App)
        expect(wrapper.find('.chat-window').exists()).toBe(true)
        expect(wrapper.find('.header').exists()).toBe(true)
        expect(wrapper.find('.messages-area').exists()).toBe(true)
        expect(wrapper.find('.input-area').exists()).toBe(true)
    })

    it('displays the initial welcome message', () => {
        const wrapper = mount(App)
        const messages = wrapper.findAll('.message-wrapper')
        expect(messages.length).toBeGreaterThan(0)
        expect(wrapper.text()).toContain('Bonjour')
    })

    it('has an input field and send button', () => {
        const wrapper = mount(App)
        expect(wrapper.find('input[type="text"]').exists()).toBe(true)
        expect(wrapper.find('button').exists()).toBe(true)
    })

    it('send button is disabled when input is empty', async () => {
        const wrapper = mount(App)
        const button = wrapper.find('button')
        // Initially, input should be empty
        expect(button.attributes('disabled')).toBeDefined()
    })
})
