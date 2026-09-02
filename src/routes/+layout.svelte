<script lang="ts">
	import './layout.css';
	import { onMount } from 'svelte';
	import favicon from '$lib/assets/favicon.svg';
	import { loadTheme } from '$lib/theme.svelte';

	let { children } = $props();

	onMount(loadTheme);
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
{@render children()}
